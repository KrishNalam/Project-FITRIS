import { RepCounter, calculateAngle } from './reps';
import { frameAngles, validGroups } from './landmarks';

const ALL = { jj: true, squat: true, sway: true, flex: true };
// Standing straight, arms by the sides.
const STAND = { hsw1: 10, hsw2: 10, sha1: 178, sha2: 178, hka1: 175, hka2: 175,
  sew1: 170, sew2: 170, csw1: 90, csw2: 90, esh1: 10, esh2: 10 };

const run = (frames) => {
  const c = new RepCounter();
  return frames.flatMap((f) => c.update({ ...STAND, ...f }, ALL));
};

test('angle', () => {
  expect(Math.round(calculateAngle([1, 0], [0, 0], [0, 1]))).toBe(90);
  expect(Math.round(calculateAngle([-1, 0], [0, 0], [1, 0]))).toBe(180);
});

test('squat counts with arms down', () => {
  expect(run([{}, { hka1: 90, hka2: 90, sha1: 150, sha2: 150 }, {}])).toEqual(['Squat']);
});

test('half squat does not count', () => {
  expect(run([{}, { hka1: 120, hka2: 120 }, {}])).toEqual([]);
});

test('jumping jacks', () => {
  const up = { hsw1: 170, hsw2: 170, sha1: 160, sha2: 160 };
  expect(run([{}, up, {}, up, {}])).toEqual(['Jumping Jack', 'Jumping Jack']);
});

test('sway needs a return to neutral', () => {
  const right = { csw1: 160, hsw1: 100 };
  expect(run([{}, right, right, {}, right])).toEqual(['Sway Right', 'Sway Right']);
});

test('flex fires once per pose', () => {
  const flex = { esh1: 80, esh2: 80, sew1: 40, sew2: 40, hsw1: 120, hsw2: 120 };
  expect(run([{}, flex, flex, {}, flex])).toEqual(['Flex', 'Flex']);
});

test('angles use pixel space, not normalized coords', () => {
  // Hip, knee, ankle forming a true right angle on a 640x480 frame.
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  lm[23] = { x: 0.5, y: 0.25 }; lm[24] = lm[23];          // hips: 120 px above knee
  lm[25] = { x: 0.5, y: 0.5 }; lm[26] = lm[25];           // knees
  lm[27] = { x: 0.5 + 120 / 640, y: 0.5 }; lm[28] = lm[27]; // ankles: 120 px right
  expect(Math.round(frameAngles(lm, 640, 480).hka1)).toBe(90);
});

test('groups are invalid when a landmark is far out of frame', () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  lm[27] = { x: 0.5, y: 2 }; // left ankle well below the frame
  const v = validGroups(lm);
  expect(v.squat).toBe(false);
  expect(v.flex).toBe(true);
});
