'use client';

import { useMemo, useState } from 'react';
import LandingFX from './LandingFX';
import { teamByConstructorId, teamLogoUrl, flagFor } from '@/lib/teams';

const MAX_DRIVERS = 3;
const GOATS = ['Senna', 'Schumacher', 'Hamilton', 'Verstappen', 'Prost', 'Lauda', 'Fangio', 'Alonso'];
const STEPS = ['IDENTITY', 'CONSTRUCTOR', 'DRIVERS', 'TEMPLE'];

// Full-screen garage build: new racers customise here before the pit lane opens.
export default function GarageSetup({ handle, drivers, constructors, circuits, initial, onDone, busy }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || '');
  const [number, setNumber] = useState(initial?.number || '');
  const [country, setCountry] = useState(initial?.country || '');
  const [fanSince, setFanSince] = useState(initial?.fanSince || '');
  const [motto, setMotto] = useState(initial?.motto || '');
  const [goat, setGoat] = useState(initial?.goat || '');
  const [teamId, setTeamId] = useState(initial?.teamId || null);
  const [circuitId, setCircuitId] = useState(initial?.circuitId || null);
  const [picked, setPicked] = useState(initial?.drivers || []);

  const team = teamId ? teamByConstructorId(teamId) : null;
  const pickedDrivers = picked.map((id) => drivers.find((d) => d.driverId === id)).filter(Boolean);
  const accent = team?.color || (pickedDrivers[0] ? teamByConstructorId(pickedDrivers[0].constructorId).color : 'var(--cyan)');
  const favCircuit = circuits.find((r) => r.circuitId === circuitId);
  const logo = teamId ? teamLogoUrl(teamId) : null;

  const toggleDriver = (id) =>
    setPicked((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : prev.length >= MAX_DRIVERS ? prev : [...prev, id]);

  const save = () => onDone({
    name: name.trim(),
    number: number ? parseInt(number, 10) : null,
    country: country.trim() || null,
    fanSince: fanSince ? parseInt(fanSince, 10) : null,
    motto: motto.trim(),
    goat: goat.trim(),
    teamId, circuitId, drivers: picked,
  });

  const accentStyle = { '--accent': accent, '--accent-glow': `color-mix(in srgb, ${accent} 35%, transparent)` };

  return (
    <div className="landing" style={accentStyle}>
      <LandingFX />
      <div className="gs-grid">
        {/* ── live preview: the garage card builds itself ── */}
        <div className="gs-preview landing-panel" style={{ boxShadow: `0 0 80px ${accent}40` }}>
          <span className="step-tag">⟡ GARAGE PREVIEW · LIVE</span>
          <div className="gs-card" style={{ borderColor: accent }}>
            <div className="gs-card-top">
              <span className="me-plate" style={{ background: accent }}>{number ? `#${number}` : '#—'}</span>
              <div>
                <div className="gs-card-name">{name || 'YOUR NAME'}</div>
                <div className="gs-card-handle">@{handle}</div>
              </div>
              {country && <span className="gs-card-flag">{flagFor(country)}</span>}
            </div>
            {motto && <div className="gs-card-motto" style={{ color: accent }}>“{motto}”</div>}
            <div className="gs-card-rows">
              <div className="gs-card-row">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="team-logo" src={logo} alt="" />
                ) : <span className="team-logo-badge" style={{ borderColor: accent, color: accent }}>{team?.name?.[0] || '?'}</span>}
                <span>{team ? team.name.toUpperCase() : 'NO CONSTRUCTOR · NEUTRAL HUD'}</span>
              </div>
              <div className="gs-card-row gs-chips">
                {pickedDrivers.length === 0 && <span style={{ color: 'var(--text-faint)' }}>NO DRIVERS FOLLOWED YET</span>}
                {pickedDrivers.map((d) => {
                  const t = teamByConstructorId(d.constructorId);
                  return (
                    <span key={d.driverId} className="car-chip small ghost" style={{ '--row-color': t.color }}>
                      <span className="car-nose" /><span className="car-code">{d.code}</span><span className="car-wing" />
                    </span>
                  );
                })}
              </div>
              {favCircuit && <div className="gs-card-row">⟡ {flagFor(favCircuit.country)} {favCircuit.circuit?.toUpperCase()}</div>}
              {(fanSince || goat) && (
                <div className="gs-card-row" style={{ color: 'var(--text-dim)' }}>
                  {fanSince ? `FAN SINCE ${fanSince}` : ''}{fanSince && goat ? ' · ' : ''}{goat ? `GOAT: ${goat.toUpperCase()}` : ''}
                </div>
              )}
            </div>
          </div>
          <div className="gs-steps">
            {STEPS.map((s, i) => (
              <button key={s} className={`tt-btn ${step === i ? 'on' : ''}`} onClick={() => setStep(i)}>
                {i + 1} · {s}
              </button>
            ))}
          </div>
        </div>

        {/* ── step content ── */}
        <div className="landing-panel">
          {step === 0 && (
            <>
              <span className="step-tag">01 / 04 · THE IDENTITY</span>
              <h2 className="landing-h2">Who&apos;s behind the wheel?</h2>
              <div className="id-grid">
                <label className="id-field span2"><span>Name</span>
                  <input type="text" maxLength={24} placeholder="YOUR NAME" value={name} autoFocus onChange={(e) => setName(e.target.value)} /></label>
                <label className="id-field"><span>Racing number · 1–99</span>
                  <input type="text" inputMode="numeric" maxLength={2} placeholder="27" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))} /></label>
                <label className="id-field"><span>Fan since</span>
                  <input type="text" inputMode="numeric" maxLength={4} placeholder="2014" value={fanSince} onChange={(e) => setFanSince(e.target.value.replace(/\D/g, ''))} /></label>
                <label className="id-field span2"><span>Country</span>
                  <input type="text" maxLength={32} placeholder="India" value={country} onChange={(e) => setCountry(e.target.value)} /></label>
                <label className="id-field span2"><span>Motto ({48 - motto.length} left)</span>
                  <input type="text" maxLength={48} placeholder="Lights out and away we go" value={motto} onChange={(e) => setMotto(e.target.value)} /></label>
                <label className="id-field span2"><span>Your GOAT</span>
                  <input type="text" maxLength={32} placeholder="Type or tap below" value={goat} onChange={(e) => setGoat(e.target.value)} />
                  <div className="goat-chips">
                    {GOATS.map((g) => <button key={g} type="button" className={`tt-btn ${goat === g ? 'on' : ''}`} onClick={() => setGoat(g)}>{g}</button>)}
                  </div>
                </label>
              </div>
              <button className="btn-primary" onClick={() => setStep(1)}>Continue ›</button>
            </>
          )}

          {step === 1 && (
            <>
              <span className="step-tag">02 / 04 · THE CONSTRUCTOR</span>
              <h2 className="landing-h2">Support a team</h2>
              <p className="landing-p">Watch the preview repaint in their color.</p>
              <div className="drv-grid">
                {constructors.map((c) => {
                  const t = teamByConstructorId(c.constructorId);
                  return (
                    <button key={c.constructorId} className={`drv-pick ${teamId === c.constructorId ? 'sel' : ''}`}
                      style={{ '--pick-color': t.color }}
                      onClick={() => setTeamId(teamId === c.constructorId ? null : c.constructorId)}>
                      <span className="c">{c.name}</span><span className="n">P{c.position} · {c.points} pts</span>
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
              <h2 className="landing-h2">Follow your drivers <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>({picked.length}/{MAX_DRIVERS})</span></h2>
              <p className="landing-p">They roll into your preview as you pick them.</p>
              <div className="drv-grid">
                {drivers.map((d) => {
                  const t = teamByConstructorId(d.constructorId);
                  const sel = picked.includes(d.driverId);
                  return (
                    <button key={d.driverId} className={`drv-pick ${sel ? 'sel' : ''}`}
                      style={{ '--pick-color': t.color, opacity: !sel && picked.length >= MAX_DRIVERS ? 0.35 : 1 }}
                      onClick={() => toggleDriver(d.driverId)}>
                      <span className="c">{sel ? '★ ' : ''}{d.code}</span><span className="n">{d.firstName} {d.lastName}</span>
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
              <h2 className="landing-h2">Your favourite circuit</h2>
              <p className="landing-p">Marked ⟡ on your calendar. Optional.</p>
              <div className="drv-grid">
                {circuits.map((r) => (
                  <button key={r.circuitId} className={`drv-pick ${circuitId === r.circuitId ? 'sel' : ''}`}
                    style={{ '--pick-color': accent }}
                    onClick={() => setCircuitId(circuitId === r.circuitId ? null : r.circuitId)}>
                    <span className="c">{flagFor(r.country)} {r.locality}</span><span className="n">{r.circuit}</span>
                  </button>
                ))}
              </div>
              <button className="btn-primary" disabled={busy} onClick={save}>
                {busy ? 'Rolling into the garage…' : '🏁 OPEN THE PIT LANE'}
              </button>
              <button className="btn-ghost" onClick={() => setStep(2)}>‹ Back</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
