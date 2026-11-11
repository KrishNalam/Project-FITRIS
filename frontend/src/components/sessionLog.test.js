import { summarizeLog } from './sessionLog';

test('session log summary', () => {
  const stats = Array.from({ length: 20 }, (_, i) => ({ fps: 30 - (i === 0 ? 20 : 0), inferMs: 10 + i, latencyMs: i < 10 ? null : 40 }));
  const events = [{ t: 1, ex: 'Squat' }, { t: 2, ex: 'Squat' }, { t: 3, ex: 'Flex' }];
  const s = summarizeLog({ t0: 0, stats, events }, 20000);
  expect(s.seconds).toBe(20);
  expect(s.fps).toEqual({ median: 30, worst: 30 }); // one stalled second in 20 is ignored by the 5th percentile
  expect(s.inferMs).toEqual({ median: 20, worst: 29 });
  expect(s.latencyMs).toEqual({ median: 40, worst: 40 });
  expect(s.moves).toEqual({ Squat: 2, Flex: 1 });
  expect(summarizeLog({ t0: 0, stats: [], events: [] }, 0).fps.median).toBeNull();
});
