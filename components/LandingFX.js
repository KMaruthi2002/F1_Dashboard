'use client';

import { useEffect, useRef } from 'react';

// Full-screen canvas: the real circuit (from GPS) glowing across the background
// with a pack of cars racing around it, leaving light trails.
const CAR_COLORS = ['#FF8000', '#FF2B2B', '#00F5D0', '#4781D7', '#229971', '#FF87BC', '#1868DB', '#01C00E', '#9C9FA2', '#6C98FF'];
const N_CARS = 9;
const TRAIL = 16;

// fallback loop if the API hasn't answered yet (stylized circuit-ish bezier)
const FALLBACK = (() => {
  const pts = [];
  for (let i = 0; i < 260; i++) {
    const t = (i / 260) * Math.PI * 2;
    const r = 1 + 0.45 * Math.sin(3 * t) + 0.18 * Math.cos(5 * t + 1.2);
    pts.push([Math.cos(t) * r, Math.sin(t) * r * 0.62]);
  }
  return pts;
})();

export default function LandingFX() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf;
    let points = FALLBACK;
    let cum = [];          // cumulative lengths for constant-speed travel
    let total = 0;
    let W = 0, H = 0, dpr = 1;
    let mapped = [];

    const cars = Array.from({ length: N_CARS }, (_, i) => ({
      p: Math.random(),                       // progress 0..1
      v: 0.018 + Math.random() * 0.02,        // laps per second-ish
      c: CAR_COLORS[i % CAR_COLORS.length],
      trail: [],
    }));

    const remap = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const rx = Math.max(maxX - minX, 1e-6), ry = Math.max(maxY - minY, 1e-6);
      // cover the viewport generously, slight rotation for drama
      const scale = Math.max(W / rx, H / ry) * 0.92;
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const rot = -0.16;
      mapped = points.map(([x, y]) => {
        const dx = (x - cx) * scale, dy = (y - cy) * scale;
        return [
          W / 2 + dx * Math.cos(rot) - dy * Math.sin(rot),
          H / 2 + (dx * Math.sin(rot) + dy * Math.cos(rot)) * -1, // flip GPS y
        ];
      });
      // cumulative arc lengths
      cum = [0]; total = 0;
      for (let i = 1; i <= mapped.length; i++) {
        const a = mapped[i - 1], b = mapped[i % mapped.length];
        total += Math.hypot(b[0] - a[0], b[1] - a[1]);
        cum.push(total);
      }
    };

    const pointAt = (t) => {
      const target = ((t % 1) + 1) % 1 * total;
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= target) lo = mid; else hi = mid; }
      const a = mapped[lo % mapped.length], b = mapped[(lo + 1) % mapped.length];
      const f = (target - cum[lo]) / Math.max(cum[lo + 1] - cum[lo], 1e-6);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    };

    const drawTrack = () => {
      ctx.beginPath();
      mapped.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,240,255,0.05)'; ctx.lineWidth = 30; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,240,255,0.16)'; ctx.lineWidth = 2.5; ctx.stroke();
    };

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, W, H);
      drawTrack();

      for (const car of cars) {
        car.p += car.v * dt;
        const [x, y] = pointAt(car.p);
        car.trail.push([x, y]);
        if (car.trail.length > TRAIL) car.trail.shift();
        // trail
        for (let i = 0; i < car.trail.length; i++) {
          const [tx, ty] = car.trail[i];
          const a = (i / car.trail.length) * 0.5;
          ctx.beginPath();
          ctx.arc(tx, ty, 2 + (i / car.trail.length) * 2.4, 0, Math.PI * 2);
          ctx.fillStyle = car.c + Math.round(a * 255).toString(16).padStart(2, '0');
          ctx.fill();
        }
        // car
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = car.c;
        ctx.shadowColor = car.c; ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(frame);
    };

    remap();
    if (reduced) { drawTrack(); } // static circuit only
    else raf = requestAnimationFrame(frame);

    // upgrade fallback loop to the real circuit once the API answers
    fetch('/api/track').then((r) => r.json()).then((d) => {
      if (d?.ok && (d.outline || []).length > 50) {
        points = d.outline;
        remap();
      }
    }).catch(() => {});

    const onResize = () => remap();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return <canvas ref={canvasRef} className="landing-fx" aria-hidden="true" />;
}
