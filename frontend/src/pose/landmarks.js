// BlazePose landmark geometry: which points each exercise needs, and the
// joint angles RepCounter consumes.
import { calculateAngle } from './reps';

export const L_SHOULDER = 11, R_SHOULDER = 12;
export const L_ELBOW = 13, R_ELBOW = 14;
export const L_WRIST = 15, R_WRIST = 16;
export const L_HIP = 23, R_HIP = 24;
export const L_KNEE = 25, R_KNEE = 26;
export const L_ANKLE = 27, R_ANKLE = 28;

export const CONNECTIONS = [
  [L_SHOULDER, R_SHOULDER], [L_SHOULDER, L_ELBOW], [L_ELBOW, L_WRIST],
  [R_SHOULDER, R_ELBOW], [R_ELBOW, R_WRIST],
  [L_SHOULDER, L_HIP], [R_SHOULDER, R_HIP], [L_HIP, R_HIP],
  [L_HIP, L_KNEE], [L_KNEE, L_ANKLE], [R_HIP, R_KNEE], [R_KNEE, R_ANKLE],
];

// Landmarks each exercise's angles use (see frameAngles); all must be seen.
const GROUPS = {
  jj: [L_HIP, R_HIP, L_SHOULDER, R_SHOULDER, L_WRIST, R_WRIST, L_ANKLE, R_ANKLE], // hsw, sha
  squat: [L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE], // hka
  sway: [L_HIP, R_HIP, L_SHOULDER, R_SHOULDER, L_WRIST, R_WRIST], // csw, hsw
  flex: [L_HIP, R_HIP, L_ELBOW, R_ELBOW, L_SHOULDER, R_SHOULDER, L_WRIST, R_WRIST], // esh, sew
};

// MediaPipe still returns guessed positions for body parts out of frame (e.g.
// legs cropped by a desk webcam); their angles jitter and fire fake reps. Only
// trust points inside the frame that the model says it can see.
const MIN_VISIBILITY = 0.5; // tune if moves drop out in poor light
const inRange = (v) => v >= -0.05 && v <= 1.05;
export const seen = (p) => inRange(p.x) && inRange(p.y) && (p.visibility ?? 1) >= MIN_VISIBILITY;

export const validGroups = (lm) =>
  Object.fromEntries(Object.entries(GROUPS).map(([name, idxs]) => [name, idxs.every((i) => seen(lm[i]))]));

// Landmarks are normalized separately by width and height, so angles are taken
// in pixel space; otherwise they stretch with the camera's aspect ratio.
export const frameAngles = (lm, w, h) => {
  const p = (i) => [lm[i].x * w, lm[i].y * h];
  const chest = [(p(L_SHOULDER)[0] + p(R_SHOULDER)[0]) / 2, (p(L_SHOULDER)[1] + p(R_SHOULDER)[1]) / 2];
  const ang = calculateAngle;
  return {
    hsw1: ang(p(L_HIP), p(L_SHOULDER), p(L_WRIST)), hsw2: ang(p(R_HIP), p(R_SHOULDER), p(R_WRIST)),
    sha1: ang(p(L_SHOULDER), p(L_HIP), p(L_ANKLE)), sha2: ang(p(R_SHOULDER), p(R_HIP), p(R_ANKLE)),
    hka1: ang(p(L_HIP), p(L_KNEE), p(L_ANKLE)), hka2: ang(p(R_HIP), p(R_KNEE), p(R_ANKLE)),
    sew1: ang(p(L_SHOULDER), p(L_ELBOW), p(L_WRIST)), sew2: ang(p(R_SHOULDER), p(R_ELBOW), p(R_WRIST)),
    csw1: ang(chest, p(L_SHOULDER), p(L_WRIST)), csw2: ang(chest, p(R_SHOULDER), p(R_WRIST)),
    esh1: ang(p(L_ELBOW), p(L_SHOULDER), p(L_HIP)), esh2: ang(p(R_ELBOW), p(R_SHOULDER), p(R_HIP)),
  };
};
