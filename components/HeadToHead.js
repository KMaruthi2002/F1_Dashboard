'use client';

import { useEffect, useState } from 'react';
import Panel from './Panel';
import { teamByConstructorId } from '@/lib/teams';

function useCareer(driverId) {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    if (!driverId) return;
    let alive = true;
    fetch(`/api/driver/${driverId}`)
      .then((r) => r.json())
      .then((d) => alive && !d.error && setData(d))
      .catch(() => {});
    return () => { alive = false; };
  }, [driverId]);
  return data;
}

function Bars({ a, b, colorA, colorB }) {
  const max = Math.max(a || 0, b || 0, 1);
  return (
    <>
      <div className="h2h-cell">
        <span className={`h2h-val ${a >= b && a > 0 ? 'win' : ''}`} style={{ '--side-color': colorA }}>{a ?? '—'}</span>
        <div className="h2h-bar left" style={{ '--side-color': colorA }}><div style={{ width: `${((a || 0) / max) * 100}%` }} /></div>
      </div>
    </>
  );
}

export default function HeadToHead({ standings }) {
  const drivers = standings?.drivers || [];
  const [idA, setIdA] = useState(null);
  const [idB, setIdB] = useState(null);

  // default to the top 2 in the championship
  useEffect(() => {
    if (drivers.length >= 2 && !idA && !idB) {
      setIdA(drivers[0].driverId);
      setIdB(drivers[1].driverId);
    }
  }, [drivers, idA, idB]);

  const A = drivers.find((d) => d.driverId === idA);
  const B = drivers.find((d) => d.driverId === idB);
  const carA = useCareer(idA);
  const carB = useCareer(idB);

  const colorA = A ? teamByConstructorId(A.constructorId).color : 'var(--cyan)';
  const colorB = B ? teamByConstructorId(B.constructorId).color : 'var(--red)';

  const metrics = [
    ['Points', A?.points, B?.points],
    ['Wins ’26', A?.wins, B?.wins],
    ['Podiums ’26', carA?.seasonPodiums, carB?.seasonPodiums],
    ['Career Wins', carA?.careerWins, carB?.careerWins],
    ['Career Poles', carA?.careerPoles, carB?.careerPoles],
  ];

  const row = (label, a, b) => {
    const max = Math.max(a || 0, b || 0, 1);
    return (
      <div className="h2h-row" key={label}>
        <div className="h2h-cell right" style={{ '--side-color': colorA }}>
          <span className={`h2h-val ${(a || 0) >= (b || 0) && a != null ? 'win' : ''}`} style={{ '--side-color': colorA }}>{a ?? '…'}</span>
          <div className="h2h-bar left" style={{ '--side-color': colorA }}><div style={{ width: `${((a || 0) / max) * 100}%` }} /></div>
        </div>
        <span className="h2h-metric">{label}</span>
        <div className="h2h-cell" style={{ '--side-color': colorB }}>
          <span className={`h2h-val ${(b || 0) >= (a || 0) && b != null ? 'win' : ''}`} style={{ '--side-color': colorB }}>{b ?? '…'}</span>
          <div className="h2h-bar right" style={{ '--side-color': colorB }}><div style={{ width: `${((b || 0) / max) * 100}%` }} /></div>
        </div>
      </div>
    );
  };

  return (
    <Panel kicker="§ VS · DUEL" title="Head-to-Head" sub="pick any two pilots">
      <div className="h2h-pickers">
        <select className="h2h-select" style={{ '--side-color': colorA }} value={idA || ''} onChange={(e) => setIdA(e.target.value)}>
          {drivers.map((d) => <option key={d.driverId} value={d.driverId}>{d.code} · {d.lastName}</option>)}
        </select>
        <span className="h2h-vs">VS</span>
        <select className="h2h-select" style={{ '--side-color': colorB, borderLeft: 'none', borderRight: `3px solid ${colorB}`, textAlign: 'right' }} value={idB || ''} onChange={(e) => setIdB(e.target.value)}>
          {drivers.map((d) => <option key={d.driverId} value={d.driverId}>{d.code} · {d.lastName}</option>)}
        </select>
      </div>
      <div className="h2h-rows">
        {metrics.map(([label, a, b]) => row(label, a, b))}
        {/* form chips */}
        <div className="h2h-row">
          <div className="h2h-cell right">
            <div className="h2h-form">
              {(carA?.lastFive || []).map((r) => {
                const pos = parseInt(r.position, 10);
                return <div key={r.round} className={`form-chip ${pos === 1 ? 'win' : pos <= 3 ? 'podium' : ''}`}>{Number.isNaN(pos) ? r.position : pos}</div>;
              })}
            </div>
          </div>
          <span className="h2h-metric">Form L5</span>
          <div className="h2h-cell">
            <div className="h2h-form">
              {(carB?.lastFive || []).map((r) => {
                const pos = parseInt(r.position, 10);
                return <div key={r.round} className={`form-chip ${pos === 1 ? 'win' : pos <= 3 ? 'podium' : ''}`}>{Number.isNaN(pos) ? r.position : pos}</div>;
              })}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
