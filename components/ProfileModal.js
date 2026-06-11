'use client';

import { useState } from 'react';
import { teamByConstructorId } from '@/lib/teams';

const MAX_DRIVERS = 3;

export default function ProfileModal({ drivers, constructors, initial, onSave, onClose }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || '');
  const [teamId, setTeamId] = useState(initial?.teamId || null);
  const [picked, setPicked] = useState(initial?.drivers || (initial?.driverId ? [initial.driverId] : []));

  const toggleDriver = (id) => {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : prev.length >= MAX_DRIVERS ? prev : [...prev, id]
    );
  };

  return (
    <div className="modal-veil" role="dialog" aria-modal="true">
      <div className="modal">
        {step === 0 && (
          <>
            <span className="step-tag">01 / 03 · THE CALLSIGN</span>
            <h2>Your name</h2>
            <p>Shown on the dashboard greeting and the leaderboard.</p>
            <input
              type="text" maxLength={24} placeholder="YOUR NAME" value={name} autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
            />
            <button className="btn-primary" onClick={() => setStep(1)}>Continue ›</button>
            {initial && <button className="btn-ghost" onClick={onClose}>Cancel</button>}
          </>
        )}

        {step === 1 && (
          <>
            <span className="step-tag">02 / 03 · THE CONSTRUCTOR</span>
            <h2>Support a team</h2>
            <p>Their color becomes your dashboard accent. Optional · skip if your heart belongs to drivers only.</p>
            <div className="drv-grid">
              {(constructors || []).map((c) => {
                const team = teamByConstructorId(c.constructorId);
                return (
                  <button
                    key={c.constructorId}
                    className={`drv-pick ${teamId === c.constructorId ? 'sel' : ''}`}
                    style={{ '--pick-color': team.color }}
                    onClick={() => setTeamId(teamId === c.constructorId ? null : c.constructorId)}
                  >
                    <span className="c">{c.name}</span>
                    <span className="n">P{c.position} · {c.points} pts</span>
                  </button>
                );
              })}
            </div>
            <button className="btn-primary" onClick={() => setStep(2)}>
              {teamId ? 'Continue ›' : 'Skip · drivers only ›'}
            </button>
            <button className="btn-ghost" onClick={() => setStep(0)}>‹ Back</button>
          </>
        )}

        {step === 2 && (
          <>
            <span className="step-tag">03 / 03 · THE DRIVERS</span>
            <h2>Follow your drivers <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>({picked.length}/{MAX_DRIVERS})</span></h2>
            <p>Pick up to {MAX_DRIVERS}. They&apos;re highlighted across timing, standings, and get their own cards.</p>
            <div className="drv-grid">
              {(drivers || []).map((d) => {
                const team = teamByConstructorId(d.constructorId);
                const sel = picked.includes(d.driverId);
                return (
                  <button
                    key={d.driverId}
                    className={`drv-pick ${sel ? 'sel' : ''}`}
                    style={{ '--pick-color': team.color, opacity: !sel && picked.length >= MAX_DRIVERS ? 0.35 : 1 }}
                    onClick={() => toggleDriver(d.driverId)}
                  >
                    <span className="c">{sel ? '★ ' : ''}{d.code}</span>
                    <span className="n">{d.firstName} {d.lastName}</span>
                  </button>
                );
              })}
            </div>
            <button
              className="btn-primary"
              disabled={picked.length === 0 && !teamId}
              onClick={() => onSave({ name: name.trim(), teamId, drivers: picked })}
            >
              Confirm garage ›
            </button>
            <button className="btn-ghost" onClick={() => setStep(1)}>‹ Back</button>
          </>
        )}
      </div>
    </div>
  );
}
