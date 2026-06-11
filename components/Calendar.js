'use client';

import { useEffect, useState } from 'react';
import Panel from './Panel';
import { flagFor, teamByConstructorId } from '@/lib/teams';

function fmt(iso, opts = { month: 'short', day: 'numeric' }) {
  return iso ? new Date(iso).toLocaleDateString(undefined, opts) : '—';
}
function fmtT(iso) {
  return iso
    ? new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

export default function Calendar({ schedule, nextRound, liveRace }) {
  const races = schedule?.races || [];
  const [openRound, setOpenRound] = useState(null);
  const [roundData, setRoundData] = useState({});

  const toggle = (r, done) => {
    const round = r.round;
    if (openRound === round) { setOpenRound(null); return; }
    setOpenRound(round);
    if (done && !roundData[round]) {
      fetch(`/api/race/${round}`)
        .then((res) => res.json())
        .then((d) => setRoundData((prev) => ({ ...prev, [round]: d })))
        .catch(() => {});
    }
  };

  const selected = races.find((r) => r.round === openRound);
  const selectedDone = selected && new Date(selected.race).getTime() < Date.now() - 4 * 3600e3;
  const detail = roundData[openRound];

  return (
    <Panel kicker="§ 04 · CAL" title="Season Calendar" sub={`${races.length || '—'} rounds · ${schedule?.season || ''} · tap a round`}>
      <div className="cal-grid">
        {races.length === 0
          ? [...Array(12)].map((_, i) => <div key={i} className="cal-tile skel" style={{ height: 120 }} />)
          : races.map((r) => {
              const done = new Date(r.race).getTime() < Date.now() - 4 * 3600e3;
              const isNext = r.round === nextRound;
              const isLive = liveRace && r.round === nextRound && liveRace.live;
              return (
                <button
                  key={r.round}
                  className={`cal-tile ${isLive ? 'live' : isNext ? 'next' : ''} ${done ? 'done' : ''}`}
                  onClick={() => (isLive ? (window.location.href = '/live') : toggle(r, done))}
                >
                  <span className="ct-round">RD {String(r.round).padStart(2, '0')}</span>
                  {isLive ? <span className="ct-tag t-live">◉ LIVE</span>
                    : isNext ? <span className="ct-tag t-next">NEXT</span>
                    : done ? <span className="ct-tag t-done">✓</span> : null}
                  <div className="ct-flag">{flagFor(r.country)}</div>
                  <div className="ct-name">{r.name.replace(' Grand Prix', ' GP')}</div>
                  <div className="ct-loc">{r.locality} · {r.country}</div>
                  <div className="ct-date">{isLive ? 'ENTER RACE CENTER →' : fmt(r.race)}</div>
                </button>
              );
            })}
      </div>

      {selected && (
        <div className="cal-expand" key={openRound}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
            RD {String(selected.round).padStart(2, '0')} · {selected.name} · {selected.circuit}
          </div>
          {selectedDone ? (
            !detail ? (
              <div className="rc-msg skel" style={{ height: 40 }} />
            ) : detail.finished ? (
              <>
                <div className="cx-pod">
                  {detail.podium?.map((p) => (
                    <span key={p.position} className={p.position === 1 ? 'p1' : ''} style={{ '--pp-color': teamByConstructorId(p.constructorId).color }}>
                      P{p.position} {p.code} · {p.time}
                    </span>
                  ))}
                  {detail.pole && (
                    <span style={{ '--pp-color': '#c084fc', color: '#c084fc' }}>◆ POLE {detail.pole.code} {detail.pole.time || ''}</span>
                  )}
                </div>
              </>
            ) : (
              <div className="rc-msg">Result not classified yet.</div>
            )
          ) : (
            <div className="cx-grid">
              {selected.fp1 && <div className="cx-item">FP1<b>{fmtT(selected.fp1)}</b></div>}
              {selected.fp2 && <div className="cx-item">FP2<b>{fmtT(selected.fp2)}</b></div>}
              {selected.fp3 && <div className="cx-item">FP3<b>{fmtT(selected.fp3)}</b></div>}
              {selected.sprintQualifying && <div className="cx-item">SPRINT QUALI<b>{fmtT(selected.sprintQualifying)}</b></div>}
              {selected.sprint && <div className="cx-item">SPRINT<b>{fmtT(selected.sprint)}</b></div>}
              {selected.qualifying && <div className="cx-item">QUALIFYING<b>{fmtT(selected.qualifying)}</b></div>}
              <div className="cx-item" style={{ borderLeft: '2px solid var(--red)' }}>GRAND PRIX<b>{fmtT(selected.race)}</b></div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
