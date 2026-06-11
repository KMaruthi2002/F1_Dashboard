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
    predictions: u.predictions || {}, createdAt: u.createdAt,
  };
};

const cleanDrivers = (arr) =>
  Array.isArray(arr) ? [...new Set(arr.filter((d) => typeof d === 'string'))].slice(0, 3) : undefined;

export async function GET() {
  // leaderboard
  if (!hasBlob()) return json({ ok: true, needsBlob: true, leaderboard: [] }, 60);
  try {
    const users = await listUsers();
    const rows = await Promise.all(users.map(async (u) => {
      const { total } = await scorePredictions(u.predictions || {});
      return { handle: u.handle, name: u.name || '', driverId: u.driverId || null, total };
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
      const { handle, name, drivers, teamId } = body;
      if (!validHandle(handle)) return err('Handle must be 3–16 letters, numbers or _');
      const existing = await getUser(handle);
      if (existing) return err('That Paddock ID is taken', 409);
      const code = makeGarageCode();
      const user = {
        handle, codeHash: sha(code),
        name: (name || '').slice(0, 24),
        drivers: cleanDrivers(drivers) || [],
        teamId: teamId || null,
        predictions: {},
        createdAt: new Date().toISOString(),
      };
      await putUser(user);
      return json({ ok: true, code, profile: publicProfile(user) }, 0);
    }

    if (action === 'login') {
      const user = await auth(body);
      if (!user) return err('Unknown Paddock ID or wrong garage code', 401);
      const scored = await scorePredictions(user.predictions || {});
      return json({ ok: true, profile: publicProfile(user), scored }, 0);
    }

    if (action === 'me') {
      const user = await auth(body);
      if (!user) return err('Session invalid — sign in again', 401);
      const scored = await scorePredictions(user.predictions || {});
      return json({ ok: true, profile: publicProfile(user), scored }, 0);
    }

    if (action === 'profile') {
      const user = await auth(body);
      if (!user) return err('Session invalid', 401);
      if (body.name !== undefined) user.name = String(body.name).slice(0, 24);
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
        if (times.race && now >= times.race) return err('Race picks are locked — lights out has happened', 423);
        if (!Array.isArray(race) || race.length !== 3 || new Set(race.filter(Boolean)).size !== race.filter(Boolean).length) {
          return err('Pick three different drivers');
        }
        next.race = race;
      }
      if (pole !== undefined) {
        if (times.quali && now >= times.quali) return err('Pole pick is locked — qualifying has started', 423);
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
