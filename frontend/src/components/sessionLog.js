// Session log for ?log mode: per-second camera stats and detected moves, so you
// can measure while standing away from the screen and read the report after.
export const newLog = () => ({ t0: performance.now(), stats: [], events: [], frames: [] });

const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

export const summarizeLog = ({ t0, stats, events }, now = performance.now()) => {
  const col = (k) => stats.map((s) => s[k]).filter((v) => v != null);
  const fps = col('fps');
  const infer = col('inferMs');
  const lat = col('latencyMs');
  const moves = {};
  events.forEach(({ ex }) => { moves[ex] = (moves[ex] || 0) + 1; });
  return {
    seconds: (now - t0) / 1000,
    samples: stats.length,
    fps: { median: pct(fps, 0.5), worst: pct(fps, 0.05) }, // worst = 5th percentile
    inferMs: { median: pct(infer, 0.5), worst: pct(infer, 0.95) },
    latencyMs: { median: pct(lat, 0.5), worst: pct(lat, 0.95) },
    moves,
  };
};

// GPU name for the resume ("on Intel Iris Xe"); browsers may mask it.
export const gpuName = () => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  } catch {
    return null;
  }
};
