// Scoring for the offline accuracy eval (eval.html). Clip labels come from the
// file name: <move>_<anything>_<expected count>.<ext>, e.g. squat_full_10.mp4,
// squat_half_0.mp4, left_arm_8.webm.
export const MOVES = { squat: 'Squat', jj: 'Jumping Jack', left: 'Sway Left', right: 'Sway Right', flex: 'Flex' };

export const parseLabel = (name) => {
  const parts = name.replace(/\.[^.]+$/, '').toLowerCase().split(/[_\s-]+/);
  const move = MOVES[parts[0]];
  const expected = Number(parts.at(-1));
  return move && parts.length > 1 && Number.isInteger(expected) ? { move, expected } : null;
};

// counts: { 'Squat': 9, 'Flex': 1, ... } detected in one clip.
// ponytail: count-based, so one missed rep plus one spurious rep cancel out;
// compare event timestamps against hand-marked rep times if that ever matters.
export const scoreClip = ({ move, expected }, counts) => {
  const hit = counts[move] || 0;
  const other = Object.entries(counts).reduce((s, [k, n]) => (k === move ? s : s + n), 0);
  return {
    expected,
    detected: Math.min(hit, expected),
    missed: Math.max(0, expected - hit),
    extra: Math.max(0, hit - expected), // same move, counted too often (e.g. half reps)
    other, // a different move fired
  };
};

export const summarize = (scores) => {
  const t = { expected: 0, detected: 0, missed: 0, extra: 0, other: 0 };
  for (const s of scores) for (const k in t) t[k] += s[k];
  return { ...t, recall: t.expected ? t.detected / t.expected : null, falseTriggers: t.extra + t.other };
};
