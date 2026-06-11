'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { teamByOpenF1Name } from '@/lib/teams';

const PAD = 60;
const W = 1000;

// Imperative track map: positions are written straight to the DOM at 60fps
// (no React re-render per frame), labels travel with their cars.
const ReplayMap = forwardRef(function ReplayMap({ bounds, outline, drivers, sourceYear, badge, badgeLive }, ref) {
  const gRefs = useRef(new Map());

  const geo = useMemo(() => {
    if (!bounds || !(outline || []).length) return null;
    const rx = Math.max(bounds.maxX - bounds.minX, 1);
    const ry = Math.max(bounds.maxY - bounds.minY, 1);
    const H = Math.round(((W - 2 * PAD) * ry) / rx + 2 * PAD);
    const mx = (x) => PAD + ((x - bounds.minX) / rx) * (W - 2 * PAD);
    const my = (y) => H - PAD - ((y - bounds.minY) / ry) * (H - 2 * PAD);
    const pts = outline.map(([x, y]) => `${mx(x).toFixed(1)},${my(y).toFixed(1)}`);
    return { H, mx, my, path: `M${pts.join(' L')} Z` };
  }, [bounds, outline]);

  useImperativeHandle(ref, () => ({
    setPositions(posMap) {
      if (!geo) return;
      for (const [n, p] of posMap) {
        const el = gRefs.current.get(+n);
        if (el) {
          el.setAttribute('transform', `translate(${geo.mx(p.x).toFixed(1)} ${geo.my(p.y).toFixed(1)})`);
          el.style.opacity = '1';
        }
      }
    },
  }), [geo]);

  if (!geo) {
    return <div className="rc-msg">Drawing the circuit from real GPS…</div>;
  }

  return (
    <div className="trackmap-wrap">
      <span className={`map-mode ${badgeLive ? 'live' : 'replay'}`}>
        {badge || `▸ REPLAY${sourceYear ? ` · ${sourceYear}` : ''} · FULL RACE`}
      </span>
      <svg className="trackmap" viewBox={`0 0 ${W} ${geo.H}`} xmlns="http://www.w3.org/2000/svg">
        <path className="outline-glow" d={geo.path} />
        <path className="outline" d={geo.path} />
        {(drivers || []).map((d) => {
          const team = teamByOpenF1Name(d.team, d.colour);
          return (
            <g
              key={d.n}
              ref={(el) => { if (el) gRefs.current.set(+d.n, el); }}
              style={{ opacity: 0 }}
            >
              <circle r={13} fill={team.color} stroke="#04050a" strokeWidth="3" />
              <text className="car-label" x={18} y={9}>{d.acr}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});

export default ReplayMap;
