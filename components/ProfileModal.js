'use client';

import { useState } from 'react';
import { teamByConstructorId, flagFor } from '@/lib/teams';

const MAX_DRIVERS = 3;
const GOATS = ['Senna', 'Schumacher', 'Hamilton', 'Verstappen', 'Prost', 'Lauda', 'Fangio', 'Alonso'];

export default function ProfileModal({ drivers, constructors, circuits, initial, onSave, onClose }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || '');
  const [number, setNumber] = useState(initial?.number || '');
  const [country, setCountry] = useState(initial?.country || '');
  const [fanSince, setFanSince] = useState(initial?.fanSince || '');
  const [motto, setMotto] = useState(initial?.motto || '');
  const [goat, setGoat] = useState(initial?.goat || '');
  const [teamId, setTeamId] = useState(initial?.teamId || null);
  const [circuitId, setCircuitId] = useState(initial?.circuitId || null);
  const [picked, setPicked] = useState(initial?.drivers || (initial?.driverId ? [initial.driverId] : []));

  const toggleDriver = (id) => {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : prev.length >= MAX_DRIVERS ? prev : [...prev, id]
    );
  };

  const save = () => onSave({
    name: name.trim(),
    number: number ? parseInt(number, 10) : null,
    country: country.trim() || null,
    fanSince: fanSince ? parseInt(fanSince, 10) : null,
    motto: motto.trim(),
    goat: goat.trim(),
    teamId,
    circuitId,
    drivers: picked,
  });

  return (
    <div className="modal-veil" role="dialog" aria-modal="true">
      <div className="modal">
        {step === 0 && (
          <>
            <span className="step-tag">01 / 04 · THE IDENTITY</span>
            <h2>Who&apos;s behind the wheel?</h2>
            <p>All optional except your name · every detail makes the HUD more yours.</p>
            <div className="id-grid">
              <label className="id-field span2">
                <span>Name</span>
                <input type="text" maxLength={24} placeholder="YOUR NAME" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="id-field">
                <span>Racing number · 1–99</span>
                <input type="text" inputMode="numeric" maxLength={2} placeholder="27" value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))} />
              </label>
              <label className="id-field">
                <span>Fan since</span>
                <input type="text" inputMode="numeric" maxLength={4} placeholder="2014" value={fanSince}
                  onChange={(e) => setFanSince(e.target.value.replace(/\D/g, ''))} />
              </label>
              <label className="id-field span2">
                <span>Country</span>
                <input type="text" maxLength={32} placeholder="India" value={country} onChange={(e) => setCountry(e.target.value)} />
              </label>
              <label className="id-field span2">
                <span>Motto · rides under your name ({48 - motto.length} left)</span>
                <input type="text" maxLength={48} placeholder="Lights out and away we go" value={motto} onChange={(e) => setMotto(e.target.value)} />
              </label>
              <label className="id-field span2">
                <span>Your GOAT</span>
                <input type="text" maxLength={32} placeholder="Type or tap one below" value={goat} onChange={(e) => setGoat(e.target.value)} />
                <div className="goat-chips">
                  {GOATS.map((g) => (
                    <button key={g} type="button" className={`tt-btn ${goat === g ? 'on' : ''}`} onClick={() => setGoat(g)}>{g}</button>
                  ))}
                </div>
              </label>
            </div>
            <button className="btn-primary" onClick={() => setStep(1)}>Continue ›</button>
            {initial && <button className="btn-ghost" onClick={onClose}>Cancel</button>}
          </>
        )}

        {step === 1 && (
          <>
            <span className="step-tag">02 / 04 · THE CONSTRUCTOR</span>
            <h2>Support a team</h2>
            <p>Their color becomes your dashboard accent. Optional.</p>
            <div className="drv-grid">
              {(constructors || []).map((c) => {
                const team = teamByConstructorId(c.constructorId);
                return (
                  <button key={c.constructorId}
                    className={`drv-pick ${teamId === c.constructorId ? 'sel' : ''}`}
                    style={{ '--pick-color': team.color }}
                    onClick={() => setTeamId(teamId === c.constructorId ? null : c.constructorId)}>
                    <span className="c">{c.name}</span>
                    <span className="n">P{c.position} · {c.points} pts</span>
                  </button>
                );
              })}
            </div>
            <button className="btn-primary" onClick={() => setStep(2)}>{teamId ? 'Continue ›' : 'Skip · drivers only ›'}</button>
            <button className="btn-ghost" onClick={() => setStep(0)}>‹ Back</button>
          </>
        )}

        {step === 2 && (
          <>
            <span className="step-tag">03 / 04 · THE DRIVERS</span>
            <h2>Follow your drivers <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>({picked.length}/{MAX_DRIVERS})</span></h2>
            <p>Pick up to {MAX_DRIVERS} · highlighted across timing and standings, each gets a card in your garage.</p>
            <div className="drv-grid">
              {(drivers || []).map((d) => {
                const team = teamByConstructorId(d.constructorId);
                const sel = picked.includes(d.driverId);
                return (
                  <button key={d.driverId}
                    className={`drv-pick ${sel ? 'sel' : ''}`}
                    style={{ '--pick-color': team.color, opacity: !sel && picked.length >= MAX_DRIVERS ? 0.35 : 1 }}
                    onClick={() => toggleDriver(d.driverId)}>
                    <span className="c">{sel ? '★ ' : ''}{d.code}</span>
                    <span className="n">{d.firstName} {d.lastName}</span>
                  </button>
                );
              })}
            </div>
            <button className="btn-primary" onClick={() => setStep(3)}>Continue ›</button>
            <button className="btn-ghost" onClick={() => setStep(1)}>‹ Back</button>
          </>
        )}

        {step === 3 && (
          <>
            <span className="step-tag">04 / 04 · THE TEMPLE</span>
            <h2>Your favourite circuit</h2>
            <p>It gets a ⟡ mark on the calendar and a countdown shoutout when its weekend arrives. Optional.</p>
            <div className="drv-grid">
              {(circuits || []).map((r) => (
                <button key={r.circuitId}
                  className={`drv-pick ${circuitId === r.circuitId ? 'sel' : ''}`}
                  style={{ '--pick-color': 'var(--accent)' }}
                  onClick={() => setCircuitId(circuitId === r.circuitId ? null : r.circuitId)}>
                  <span className="c">{flagFor(r.country)} {r.locality}</span>
                  <span className="n">{r.circuit}</span>
                </button>
              ))}
            </div>
            <button className="btn-primary" disabled={!name.trim() && picked.length === 0 && !teamId} onClick={save}>
              🏁 Confirm my garage
            </button>
            <button className="btn-ghost" onClick={() => setStep(2)}>‹ Back</button>
          </>
        )}
      </div>
    </div>
  );
}
