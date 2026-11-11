import { parseLabel, scoreClip, summarize } from './score';

test('labels from file names', () => {
  expect(parseLabel('squat_full_10.mp4')).toEqual({ move: 'Squat', expected: 10 });
  expect(parseLabel('JJ-take2-0.webm')).toEqual({ move: 'Jumping Jack', expected: 0 });
  expect(parseLabel('right_8.mov')).toEqual({ move: 'Sway Right', expected: 8 });
  expect(parseLabel('IMG_1234.mp4')).toBeNull();
  expect(parseLabel('squat_full.mp4')).toBeNull();
});

test('scoring and summary', () => {
  const full = scoreClip({ move: 'Squat', expected: 10 }, { Squat: 9, Flex: 1 });
  expect(full).toEqual({ expected: 10, detected: 9, missed: 1, extra: 0, other: 1 });
  const half = scoreClip({ move: 'Squat', expected: 0 }, { Squat: 2 });
  expect(half).toEqual({ expected: 0, detected: 0, missed: 0, extra: 2, other: 0 });
  const s = summarize([full, half]);
  expect(s.recall).toBe(0.9);
  expect(s.falseTriggers).toBe(3);
});
