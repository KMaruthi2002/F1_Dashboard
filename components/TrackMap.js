'use client';

import { useMemo } from 'react';
import { teamByOpenF1Name } from '@/lib/teams';

const PAD = 60;
const W = 1000;

export default function TrackMap({ track, grid, selected, onSelect }) {
  const { path, dots, H } = useMemo(() => {
    const b = track?.bounds;
    if (!b || !(track?.outline || []).length) return { path: '', dots: [], H: 700 };

    const rx = Math.max(b.maxX - b.minX, 1);
    const ry = Math.max(b.maxY - b.minY, 1);
    const H = Math.round(((W - 2 * PAD) * ry) / rx + 2 * PAD);

    const mx = (x) => PAD + ((x - b.minX) / rx) * (W - 2 * PAD);
    const my = (y) => H - PAD - ((y - b.minY) / ry) * (H - 2 * PAD); // flip Y

    const pts = track.outline.map(([x, y]) => `${mx(x).toFixed(1)},${my(y).toFixed(1)}`);
    const path = `M${pts.join(' L')} Z`;

    const byNum = new Map((grid || []).map((g) => [+g.number, g]));
    const dots = (track.cars || []).map((c) => {
      const g = byNum.get(+c.n);
      const team = teamByOpenF1Name(c.team || g?.team, c.colour || g?.teamColour);
      return {
        n: c.n,
        x: mx(c.x),
        y: my(c.y),
        color: team.color,
        acr: c.acr || g?.acronym || `#${c.n}`,
        pos: g?.position,
      };
    });

    return { path, dots, H };
  }, [track, grid]);

  if (!path) {
    return <div className="rc-msg">Track trace not available yet — the map draws itself from real car GPS once a session has run.</div>;
  }

  return (
    <div className="trackmap-wrap">
      <span className={`map-mode ${track.mode === 'LIVE' ? 'live' : 'replay'}`}>
        {track.mode === 'LIVE' ? '◉ LIVE GPS' : `▸ REPLAY${track.sourceYear ? ` · ${track.sourceYear}` : ''} · FINAL LAPS`}
      </span>
      <svg className="trackmap" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <path className="outline-glow" d={path} />
        <path className="outline" d={path} />
        {dots.map((d) => (
          <g key={d.n} onClick={() => onSelect?.(d.n)} style={{ cursor: 'pointer' }}>
            {selected === d.n && (
              <circle className="car-ring" cx={d.x} cy={d.y} r={30} stroke={d.color}>
                <animate attributeName="r" values="24;34;24" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            <circle className="car" cx={d.x} cy={d.y} r={14} fill={d.color} stroke="#04050a" strokeWidth="3" />
            <text className="car-label" x={d.x + 20} y={d.y + 9}>{d.acr}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
