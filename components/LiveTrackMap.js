'use client';

import { useEffect, useRef } from 'react';
import ReplayMap from './ReplayMap';
import { interpolateTracks, mergeChunk, trimBuffer } from '@/lib/interp';

// Smooth live map: plays the GPS feed ~30s behind real time (broadcast-style
// buffering) and interpolates at 60fps, so cars glide along the racing line.
const DELAY_MS = 30e3;
const CHUNK_S = 30;
const POLL_MS = 10e3;

export default function LiveTrackMap({ bounds, outline, sessionKey, drivers }) {
  const mapRef = useRef(null);
  const buf = useRef({ tracks: new Map(), end: 0 });
  const fetching = useRef(false);

  useEffect(() => {
    if (!sessionKey) return;
    let alive = true;
    buf.current = { tracks: new Map(), end: Date.now() - DELAY_MS - CHUNK_S * 1000 };

    const loadNext = async () => {
      if (!alive || fetching.current) return;
      const from = buf.current.end;
      // only fetch windows that are fully in the past (feed has ~3s ingest delay)
      if (from + CHUNK_S * 1000 > Date.now() - 5e3) return;
      fetching.current = true;
      try {
        const res = await fetch(
          `/api/replay?sk=${sessionKey}&from=${new Date(from).toISOString().slice(0, 19)}&dur=${CHUNK_S}`
        );
        const d = await res.json();
        if (alive && d?.ok) {
          mergeChunk(buf.current.tracks, d.tracks, from);
          buf.current.end = from + (d.durMs || CHUNK_S * 1000);
          trimBuffer(buf.current.tracks, Date.now() - DELAY_MS - 20e3);
        }
      } catch { /* retry on next poll */ }
      fetching.current = false;
    };

    loadNext();
    const poll = setInterval(loadNext, POLL_MS);

    let raf;
    const step = () => {
      if (!alive) return;
      mapRef.current?.setPositions(interpolateTracks(buf.current.tracks, Date.now() - DELAY_MS));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => { alive = false; clearInterval(poll); cancelAnimationFrame(raf); };
  }, [sessionKey]);

  return (
    <ReplayMap
      ref={mapRef}
      bounds={bounds}
      outline={outline}
      drivers={drivers}
      badge="◉ LIVE · SMOOTH FEED · ~30s"
      badgeLive
    />
  );
}
