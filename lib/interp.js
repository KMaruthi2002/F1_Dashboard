// Shared trajectory interpolation: where is every car at time t?
// tracks: Map(driverNumber → [[tMs, x, y], ...] sorted ascending)
export function interpolateTracks(tracks, c) {
  const pos = new Map();
  for (const [n, arr] of tracks) {
    if (!arr.length) continue;
    const hi0 = arr.length - 1;
    if (c <= arr[0][0]) {
      if (arr[0][0] - c < 5e3) pos.set(n, { x: arr[0][1], y: arr[0][2] });
      continue;
    }
    if (c >= arr[hi0][0]) {
      if (c - arr[hi0][0] < 8e3) pos.set(n, { x: arr[hi0][1], y: arr[hi0][2] });
      continue;
    }
    let lo = 0, hi = hi0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid][0] <= c) lo = mid; else hi = mid;
    }
    const [t0, x0, y0] = arr[lo];
    const [t1, x1, y1] = arr[hi];
    const f = (c - t0) / Math.max(t1 - t0, 1);
    pos.set(n, { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f });
  }
  return pos;
}

// Merge a chunk of server tracks ({n: [[dtMs,x,y],...]}) into a buffer Map at absolute offset
export function mergeChunk(bufferTracks, chunkTracks, offsetMs) {
  for (const [n, samples] of Object.entries(chunkTracks || {})) {
    const arr = bufferTracks.get(+n) || [];
    const lastT = arr.length ? arr[arr.length - 1][0] : -Infinity;
    for (const [dt, x, y] of samples) {
      const t = offsetMs + dt;
      if (t > lastT) arr.push([t, x, y]);
    }
    bufferTracks.set(+n, arr);
  }
}

export function trimBuffer(bufferTracks, cutoff) {
  for (const arr of bufferTracks.values()) {
    while (arr.length > 2 && arr[0][0] < cutoff) arr.shift();
  }
}
