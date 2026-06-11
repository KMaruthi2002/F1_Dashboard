'use client';

import { useState } from 'react';
import { teamByConstructorId } from '@/lib/teams';

export default function ProfileModal({ drivers, initial, onSave, onClose }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || '');
  const [driverId, setDriverId] = useState(initial?.driverId || null);

  const canFinish = !!driverId;

  return (
    <div className="modal-veil" role="dialog" aria-modal="true">
      <div className="modal">
        {step === 0 ? (
          <>
            <span className="step-tag">01 / 02 · THE CALLSIGN</span>
            <h2>Sign your name</h2>
            <p>Your name rides on the dashboard — greeting, header, footer. Quiet, never loud.</p>
            <input
              type="text"
              maxLength={24}
              placeholder="YOUR NAME"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
            />
            <button className="btn-primary" onClick={() => setStep(1)}>
              Continue ›
            </button>
            {initial && (
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
            )}
          </>
        ) : (
          <>
            <span className="step-tag">02 / 02 · THE DRIVER</span>
            <h2>Pick your driver</h2>
            <p>Their team color rides shotgun across the whole HUD. You&apos;ll see them first, every time.</p>
            <div className="drv-grid">
              {(drivers || []).map((d) => {
                const team = teamByConstructorId(d.constructorId);
                return (
                  <button
                    key={d.driverId}
                    className={`drv-pick ${driverId === d.driverId ? 'sel' : ''}`}
                    style={{ '--pick-color': team.color }}
                    onClick={() => setDriverId(d.driverId)}
                  >
                    <span className="c">{d.code}</span>
                    <span className="n">{d.firstName} {d.lastName}</span>
                  </button>
                );
              })}
            </div>
            <button
              className="btn-primary"
              disabled={!canFinish}
              onClick={() => onSave({ name: name.trim(), driverId })}
            >
              Confirm driver ›
            </button>
            <button className="btn-ghost" onClick={() => setStep(0)}>‹ Back</button>
          </>
        )}
      </div>
    </div>
  );
}
