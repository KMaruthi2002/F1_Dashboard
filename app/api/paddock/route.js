import {
  hasBlob, sha, makeGarageCode, validHandle,
  getUser, putUser, listUsers, scorePredictions, getRoundTimes,
} from '@/lib/paddock';
import { json } from '@/lib/f1';

export const dynamic = 'force-dynamic';

const err = (message, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  });

async function auth(body) {
  const { handle, code } = body || {};
  if (!validHandle(handle) || !code) return null;
  const user = await getUser(handle);
  if (!user || user.codeHash !== sha(code)) return null;
  return user;
}

const publicProfile = (u) => {
  const drivers = u.drivers || (u.driverId ? [u.driverId] : []);
  return {
    handle: u.handle, name: u.name || '',
    drivers,                              // up to 3 supported drivers
    teamId: u.teamId || null,             // supported constructor
    driverId: drivers[0] || null,         // legacy: primary driver
    circuitId: u.circuitId || null,       // favourite circuit
    number: u.number || null,             // personal racing number 1-99
    country: u.country || null,           // fan's country
    fanSince: u.fanSince || null,         // year they fell for F1
    motto: u.motto || '',                 // short tagline
    goat: u.goat || '',                   // their GOAT
    predictions: u.predictions || {}, createdAt: u.createdAt,
  };
};

// sanitize the identity fields
function applyIdentity(user, body) {
  if (body.name !== undefined) user.name = String(body.name).slice(0, 24);
  if (body.circuitId !== undefined) user.circuitId = body.circuitId ? String(body.circuitId).slice(0, 40) : null;
  if (body.number !== undefined) {
    const n = parseInt(body.number, 10);
    user.number = Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
  }
  if (body.country !== undefined) user.country = body.country ? String(body.country).slice(0, 32) : null;
  if (body.fanSince !== undefined) {
    const y = parseInt(body.fanSince, 10);
    user.fanSince = Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() ? y : null;
  }
  if (body.motto !== undefined) user.motto = String(body.motto || '').slice(0, 48);
  if (body.goat !== undefined) user.goat = String(body.goat || '').slice(0, 32);
}

const cleanDrivers = (arr) =>
  Array.isArray(arr) ? [...new Set(arr.filter((d) => typeof d === 'string'))].slice(0, 3) : undefined;

export async function GET(req) {
  if (!hasBlob()) return json({ ok: true, needsBlob: true, leaderboard: [] }, 60);
  try {
    // ── public racer profile: /api/paddock?racer=handle ──
    const racer = new URL(req.url).searchParams.get('racer');
    if (racer) {
      const u = await getUser(racer);
      if (!u) return json({ ok: false, error: 'No racer with that Paddock ID' }, 60);
      const scored = await scorePredictions(u.predictions || {});
      // rank among all racers
      const users = await listUsers();
      const totals = await Promise.all(users.map(async (x) => {
        const s = await scorePredictions(x.predictions || {});
        return { handle: x.handle, total: s.total };
      }));
      totals.sort((a, b) => b.total - a.total);
      const rank = totals.findIndex((t) => t.handle.toLowerCase() === racer.toLowerCase()) + 1;

      // public view: settled rounds only — never leak upcoming picks
      const history = Object.entries(scored.rounds || {})
        .filter(([, s]) => s.settled)
        .map(([round, s]) => ({ round: +round, points: s.points, detail: s.detail }));
      const pendingPicks = Object.entries(scored.rounds || {}).filter(([, s]) => !s.settled).length;

      const p = publicProfile(u);
      delete p.predictions;
      return json({
        ok: true,
        profile: p,
        total: scored.total,
        rank: rank || null,
        racers: totals.length,
        history,
        pendingPicks,
      }, 120);
    }
    const users = await listUsers();
    const rows = await Promise.all(users.map(async (u) => {
      const { total } = await scorePredictions(u.predictions || {});
      const drivers = u.drivers || (u.driverId ? [u.driverId] : []);
      return {
        handle: u.handle, name: u.name || '', driverId: drivers[0] || null,
        teamId: u.teamId || null, country: u.country || null,
        number: u.number || null, motto: u.motto || '', total,
      };
    }));
    rows.sort((a, b) => b.total - a.total);
    return json({ ok: true, leaderboard: rows.slice(0, 25) }, 120);
  } catch (e) {
    return json({ ok: false, error: e.message }, 30);
  }
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return err('bad json'); }
  const action = body.action;

  try {
    // ── stateless scoring (guest / local mode) ──
    if (action === 'score') {
      const scored = await scorePredictions(body.predictions || {});
      return json({ ok: true, ...scored }, 0);
    }

    if (!hasBlob()) return json({ ok: false, needsBlob: true }, 0);

    if (action === 'register') {
      const { handle, name, drivers, teamId, password } = body;
      if (!validHandle(handle)) return err('Handle must be 3–16 letters, numbers or _');
      if (password !== undefined && (typeof password !== 'string' || password.length < 6 || password.length > 64)) {
        return err('Password must be 6–64 characters');
      }
      const existing = await getUser(handle);
      if (existing) return err('That Paddock ID is taken', 409);
      // user-chosen password preferred; generated garage code as legacy fallback
      const code = password || makeGarageCode();
      const user = {
        handle, codeHash: sha(code),
        name: (name || '').slice(0, 24),
        drivers: cleanDrivers(drivers) || [],
        teamId: teamId || null,
        predictions: {},
        createdAt: new Date().toISOString(),
      };
      await putUser(user);
      // only reveal a code when WE generated it; chosen passwords are never echoed
      return json({ ok: true, code: password ? null : code, profile: publicProfile(user) }, 0);
    }

    if (action === 'password') {
      const user = await auth(body);
      if (!user) return err('Current password is wrong', 401);
      const { newPassword } = body;
      if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 64) {
        return err('New password must be 6–64 characters');
      }
      user.codeHash = sha(newPassword);
      await putUser(user);
      return json({ ok: true }, 0);
    }

    if (action === 'login') {
      const user = await auth(body);
      if (!user) return err('Unknown Paddock ID or wrong garage code', 401);
      const scored = await scorePredictions(user.predictions || {});
      return json({ ok: true, profile: publicProfile(user), scored }, 0);
    }

    if (action === 'me') {
      const user = await auth(body);
      if (!user) return err('Session invalid · sign in again', 401);
      const scored = await scorePredictions(user.predictions || {});
      return json({ ok: true, profile: publicProfile(user), scored }, 0);
    }

    if (action === 'profile') {
      const user = await auth(body);
      if (!user) return err('Session invalid', 401);
      applyIdentity(user, body);
      if (body.driverId !== undefined) user.drivers = cleanDrivers([body.driverId, ...(user.drivers || [])]);
      if (body.drivers !== undefined) user.drivers = cleanDrivers(body.drivers) || [];
      if (body.teamId !== undefined) user.teamId = body.teamId;
      await putUser(user);
      return json({ ok: true, profile: publicProfile(user) }, 0);
    }

    if (action === 'predict') {
      const user = await auth(body);
      if (!user) return err('Session invalid', 401);
      const { round, race, pole, sprint } = body;
      if (!round) return err('round required');
      const times = await getRoundTimes(round);
      if (!times) return err('unknown round');
      const now = Date.now();

      user.predictions = user.predictions || {};
      const prev = user.predictions[round] || {};
      const next = { ...prev };

      if (race !== undefined) {
        if (times.race && now >= times.race) return err('Race picks are locked · lights out has happened', 423);
        if (!Array.isArray(race) || race.length !== 3 || new Set(race.filter(Boolean)).size !== race.filter(Boolean).length) {
          return err('Pick three different drivers');
        }
        next.race = race;
      }
      if (pole !== undefined) {
        if (times.quali && now >= times.quali) return err('Pole pick is locked · qualifying has started', 423);
        next.pole = pole;
      }
      if (sprint !== undefined) {
        if (!times.hasSprint) return err('No sprint this weekend');
        if (times.sprint && now >= times.sprint) return err('Sprint pick is locked', 423);
        next.sprint = sprint;
      }
      next.savedAt = new Date().toISOString();
      user.predictions[round] = next;
      await putUser(user);
      const scored = await scorePredictions(user.predictions);
      return json({ ok: true, profile: publicProfile(user), scored }, 0);
    }

    return err('unknown action');
  } catch (e) {
    return err(e.message, 500);
  }
}
