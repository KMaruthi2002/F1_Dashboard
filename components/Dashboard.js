'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hero from './Hero';
import TimingTower from './TimingTower';
import { DriverStandings, ConstructorStandings } from './Standings';
import Calendar from './Calendar';
import { RaceResults, RaceConditions, TireStrategy, QualiRecap } from './LastRace';
import FavDriver from './FavDriver';
import ProfileModal from './ProfileModal';
import SectionNav from './SectionNav';
import DriverDrawer from './DriverDrawer';
import HeadToHead from './HeadToHead';
import AccountModal from './AccountModal';
import { useAuth } from './AuthProvider';
import { teamByConstructorId } from '@/lib/teams';

const LS_KEY = 'apex.profile.v1';

const BOOT_LINES = [
  'ESTABLISHING TELEMETRY UPLINK…',
  'SYNCING TIMING TOWER [OPENF1]…',
  'PULLING FIA CLASSIFICATION [JOLPICA]…',
  'CALIBRATING TIRE MODELS…',
  'ALL SYSTEMS GREEN',
];

function Boot({ done }) {
  const [lights, setLights] = useState(0);
  const [line, setLine] = useState(0);
  const [green, setGreen] = useState(false);

  useEffect(() => {
    const li = setInterval(() => setLights((v) => Math.min(v + 1, 5)), 380);
    const lo = setInterval(() => setLine((v) => Math.min(v + 1, BOOT_LINES.length - 1)), 460);
    const g = setTimeout(() => setGreen(true), 2100);
    return () => { clearInterval(li); clearInterval(lo); clearTimeout(g); };
  }, []);

  return (
    <div className={`boot ${done ? 'done' : ''}`} aria-hidden={done}>
      <div className="boot-logo">APEX <em>//</em> TELEMETRY</div>
      <div className="boot-lights">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`boot-light ${green ? 'green' : i < lights ? 'on' : ''}`} />
        ))}
      </div>
      <div className="boot-log">
        {green ? <span className="ok">▮ {BOOT_LINES[BOOT_LINES.length - 1]} — LIGHTS OUT</span> : `▮ ${BOOT_LINES[line]}`}
      </div>
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function ToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button className={`to-top ${show ? 'show' : ''}`} aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>▲</button>
  );
}

export default function Dashboard() {
  const { account, scored, updateProfile } = useAuth();
  const [booted, setBooted] = useState(false);
  const [standings, setStandings] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [lastRace, setLastRace] = useState(null);
  const [live, setLive] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [showProfile, setShowProfile] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [drawerDriver, setDrawerDriver] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const clock = useClock();
  const liveTimer = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 2900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      setProfile(raw ? JSON.parse(raw) : null);
    } catch { setProfile(null); }
  }, []);

  const saveProfile = useCallback((p) => {
    setProfile(p);
    setShowProfile(false);
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
    // signed in → sync name + driver to the cloud account too
    if (account) updateProfile({ name: p.name, driverId: p.driverId });
  }, [account, updateProfile]);

  // effective identity: cloud account wins over local guest profile
  const effProfile = useMemo(() => {
    if (account) {
      return {
        name: account.name || account.handle,
        teamId: account.teamId || null,
        drivers: account.drivers || [],
        driverId: account.drivers?.[0] || null,
      };
    }
    if (!profile) return profile;
    // migrate old local shape {driverId} → {drivers: []}
    const drivers = profile.drivers || (profile.driverId ? [profile.driverId] : []);
    return { ...profile, drivers, driverId: drivers[0] || null };
  }, [account, profile]);

  useEffect(() => {
    // first-run customization for guests only — account holders did it at the gate
    if (booted && profile === null && !account) setShowProfile(true);
  }, [booted, profile, account]);

  const fetchJson = (url) => fetch(url).then((r) => r.json()).catch(() => null);

  const loadSlow = useCallback(async () => {
    const [st, sc, lr] = await Promise.all([
      fetchJson('/api/standings'),
      fetchJson('/api/schedule'),
      fetchJson('/api/lastrace'),
    ]);
    if (st && !st.error) setStandings(st);
    if (sc && !sc.error) setSchedule(sc);
    if (lr && !lr.error) setLastRace(lr);
    setLastSync(new Date());
  }, []);

  const loadLive = useCallback(async () => {
    const lv = await fetchJson('/api/live');
    if (lv && !lv.error) {
      setLive(lv);
      setLastSync(new Date());
      clearTimeout(liveTimer.current);
      liveTimer.current = setTimeout(loadLive, lv.live ? 30e3 : 300e3);
    } else {
      clearTimeout(liveTimer.current);
      liveTimer.current = setTimeout(loadLive, 120e3);
    }
  }, []);

  useEffect(() => {
    loadSlow();
    loadLive();
    const slow = setInterval(loadSlow, 600e3);
    return () => { clearInterval(slow); clearTimeout(liveTimer.current); };
  }, [loadSlow, loadLive]);

  const nextRace = useMemo(() => {
    const races = schedule?.races || [];
    const now = Date.now();
    return races.find((r) => new Date(r.race).getTime() + 3 * 3600e3 > now) || null;
  }, [schedule]);

  const favStanding = useMemo(
    () => (standings?.drivers || []).find((d) => d.driverId === effProfile?.driverId),
    [standings, effProfile]
  );

  // car number → headshot URL (for avatars across the dashboard)
  const headshotByNum = useMemo(
    () => Object.fromEntries((lastRace?.openf1Drivers || []).map((d) => [+d.number, d.headshot])),
    [lastRace]
  );
  // accent priority: supported TEAM color → first followed driver's team color
  const accent = useMemo(() => {
    if (effProfile?.teamId) return teamByConstructorId(effProfile.teamId).color;
    if (favStanding) return teamByConstructorId(favStanding.constructorId).color;
    return null;
  }, [effProfile, favStanding]);
  const accentStyle = accent
    ? { '--accent': accent, '--accent-glow': `color-mix(in srgb, ${accent} 35%, transparent)` }
    : {};

  // all followed drivers → highlight sets
  const favIds = useMemo(() => new Set(effProfile?.drivers || []), [effProfile]);
  const favNumbers = useMemo(() => {
    const nums = new Set();
    for (const d of standings?.drivers || []) if (favIds.has(d.driverId)) nums.add(+d.number);
    return nums;
  }, [standings, favIds]);

  // resolve OpenF1 car number → standings driver for the drawer
  const selectByNumber = useCallback((num) => {
    const d = (standings?.drivers || []).find((x) => +x.number === +num);
    if (d) setDrawerDriver(d);
  }, [standings]);

  const tickerItems = useMemo(() => {
    const items = [];
    const leader = standings?.drivers?.[0];
    if (leader) items.push(<span key="l">WDC LEAD <b className="hl">{leader.code} · {leader.points} PTS</b></span>);
    const teamLeader = standings?.constructors?.[0];
    if (teamLeader) items.push(<span key="c">WCC LEAD <b className="hl">{teamLeader.name?.toUpperCase()} · {teamLeader.points} PTS</b></span>);
    const winner = lastRace?.results?.[0];
    if (winner) items.push(<span key="w">LAST RACE <b className="rd">{lastRace.name?.toUpperCase()}</b> WINNER <b className="hl">{winner.code}</b></span>);
    const fl = (lastRace?.results || []).find((r) => r.fastestLap?.rank === 1);
    if (fl) items.push(<span key="f">FASTEST LAP <b className="hl">{fl.code} · {fl.fastestLap.time}</b></span>);
    if (nextRace) items.push(<span key="n">NEXT <b className="rd">RD {nextRace.round} · {nextRace.name?.toUpperCase()}</b></span>);
    if (live?.live) items.push(<span key="live"><b className="rd">◉ SESSION LIVE — {live.session?.name?.toUpperCase()} · {live.session?.circuit?.toUpperCase()}</b></span>);
    items.push(<span key="x">APEX // TELEMETRY · LIGHTS OUT AND AWAY WE GO</span>);
    return items;
  }, [standings, lastRace, nextRace, live]);

  return (
    <div style={accentStyle}>
      <Boot done={booted} />

      <div className="shell">
        <header className="statusbar">
          <span className="brand">APEX <em>//</em> TELEMETRY</span>
          <span className="status-pip">
            <span className={`pip ${live?.live ? 'red' : ''}`} />
            {live?.live ? 'SESSION LIVE' : 'UPLINK OK'}
          </span>
          <span className="spacer" />
          <span className="clock hide-sm" suppressHydrationWarning>
            {clock ? clock.toLocaleTimeString(undefined, { hour12: false }) : '--:--:--'}
          </span>
          {lastSync && <span className="hide-sm">SYNC {lastSync.toLocaleTimeString(undefined, { hour12: false })}</span>}
          <button onClick={() => setShowAccount(true)}>
            {account ? `⟡ ${account.handle} · ${scored?.total ?? 0} PP` : effProfile?.name ? `⟡ ${effProfile.name}` : '⟡ Sign in'}
          </button>
        </header>

        <SectionNav />

        <div className="ticker">
          <div className="ticker-inner">
            {tickerItems}
            {tickerItems}
          </div>
        </div>
        <div className="kerb" style={{ margin: '0 calc(-1 * clamp(14px, 3vw, 40px))' }} />

        {/* mission tiles — the hub */}
        <div className="mission-tiles">
          <a className="mission-tile" href="/live" style={{ '--tile-color': live?.live ? 'var(--green)' : 'var(--cyan)' }}>
            {live?.live && <span className="mt-live">◉ LIVE</span>}
            <span className="mt-icon">📡</span>
            <div className="mt-title">Live Center</div>
            <div className="mt-desc">
              {live?.session ? `${live.session.name} · ${live.session.circuit}` : 'Track map'} · GPS · laps · tires · onboard
            </div>
          </a>
          <a className="mission-tile" href="/replay" style={{ '--tile-color': 'var(--amber)' }}>
            <span className="mt-icon">⟲</span>
            <div className="mt-title">Race Replay</div>
            <div className="mt-desc">Time machine · scrub any moment · incident alerts + official footage</div>
          </a>
          <a className="mission-tile" href="/paddock" style={{ '--tile-color': '#c084fc' }}>
            <span className="mt-icon">🏆</span>
            <div className="mt-title">The Paddock</div>
            <div className="mt-desc">Drag your podium call · earn Paddock Points · global leaderboard</div>
          </a>
        </div>

        <div id="command">
          <Hero nextRace={nextRace} profile={effProfile} season={schedule?.season} />
        </div>

        <div id="live" className="section fade-in">
          <TimingTower live={live} favNumbers={favNumbers} onSelectNumber={selectByNumber} />
        </div>

        <div id="championship" className="grid-2 fade-in">
          <DriverStandings standings={standings} favIds={favIds} onSelect={setDrawerDriver} headshots={headshotByNum} />
          <ConstructorStandings standings={standings} />
        </div>

        <div id="versus" className="section fade-in">
          <HeadToHead standings={standings} />
        </div>

        <div id="calendar" className="section fade-in">
          <Calendar schedule={schedule} nextRound={nextRace?.round} liveRace={live} />
        </div>

        <div id="race" className="section fade-in">
          <RaceResults lastRace={lastRace} />
        </div>

        <div className="grid-2 fade-in">
          <RaceConditions lastRace={lastRace} />
          <TireStrategy lastRace={lastRace} />
        </div>

        <div id="pilot" className="grid-2 fade-in">
          <QualiRecap lastRace={lastRace} />
          <FavDriver
            profile={effProfile}
            standings={standings}
            lastRace={lastRace}
            onEdit={() => setShowProfile(true)}
          />
        </div>

        <div className="kerb thin" style={{ marginTop: 60 }} />
        <footer className="footer" style={{ marginTop: 0, borderTop: 'none', paddingTop: 20 }}>
          <span className="brand">APEX <em>//</em> TELEMETRY</span>
          <span>DATA · JOLPICA F1 + OPENF1 · AUTO-REFRESH</span>
          <span className="right">UNOFFICIAL FAN PROJECT · NOT AFFILIATED WITH F1, FIA OR FOM</span>
        </footer>
      </div>

      <ToTop />

      {drawerDriver && (
        <DriverDrawer
          driver={drawerDriver}
          lastRace={lastRace}
          isFavourite={favIds.has(drawerDriver.driverId)}
          onFavourite={(driverId) => {
            const drivers = favIds.has(driverId)
              ? (effProfile?.drivers || []).filter((d) => d !== driverId)
              : [...new Set([...(effProfile?.drivers || []), driverId])].slice(0, 3);
            saveProfile({ ...(effProfile || {}), drivers });
            setDrawerDriver(null);
          }}
          onClose={() => setDrawerDriver(null)}
        />
      )}

      {showAccount && (
        <AccountModal onClose={() => setShowAccount(false)} onEditProfile={() => setShowProfile(true)} />
      )}

      {showProfile && profile !== undefined && (
        <ProfileModal
          drivers={standings?.drivers || []}
          constructors={standings?.constructors || []}
          initial={effProfile}
          onSave={saveProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
