'use client';

import { useEffect, useState } from 'react';

const SECTIONS = [
  ['command', '◆ Command'],
  ['live', '◉ Timing'],
  ['championship', '§ Standings'],
  ['versus', '⚔ Head-to-Head'],
  ['calendar', '▦ Calendar'],
  ['race', '🏁 Last Race'],
  ['pilot', '⟡ Your Driver'],
];

export default function SectionNav() {
  const [active, setActive] = useState('command');

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <nav className="secnav" aria-label="Sections">
      {SECTIONS.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'active' : ''}>
          {label}
        </a>
      ))}
    </nav>
  );
}
