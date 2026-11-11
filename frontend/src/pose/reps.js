// Rep detection: joint angles per frame in, completed exercises out.
// Each exercise has its own state machine, so one exercise's checks can never
// reset another's (they used to share one `stage`, which broke squats).

export const calculateAngle = (a, b, c) => {
  const radians = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(a[1] - b[1], a[0] - b[0]);
  const angle = Math.abs((radians * 180) / Math.PI);
  return angle > 180 ? 360 - angle : angle;
};

// `a` maps names to degrees: hsw (hip-shoulder-wrist), sha (shoulder-hip-ankle),
// hka (hip-knee-ankle), sew (shoulder-elbow-wrist), csw (chest-shoulder-wrist),
// esh (elbow-shoulder-hip); suffix 1 = left landmark, 2 = right landmark.
// `valid` says which exercise groups had every landmark in frame.
// Tuning knob: frames a pose must hold before it counts, to ignore one-frame
// landmark glitches. Off (1) for now: at 20 fps the top of a real jumping jack
// lasts only 1-3 frames, so 3 dropped real reps in a logged session. Tune it
// against labelled clips (eval.html). ponytail: frame-based, so the hold time
// shrinks on faster cameras; switch to timestamps if that matters.
export const HOLD_FRAMES = 1;

export class RepCounter {
  constructor(holdFrames = HOLD_FRAMES) {
    this.holdFrames = holdFrames;
    this.jj = null;    // jumping jack: jjdown1 / jjup1 / jjdown2 / jjup2
    this.squat = null; // 'down' once the knees bend past 100 deg
    this.sway = null;  // 'neutral' with both arms down, else 'left' / 'right'
    this.flex = null;  // 'up' while flexing, 'down' once the arms are lowered
    this.hold = { jj: {}, squat: {}, sway: {}, flex: {} }; // consecutive-frame counts per pose
  }

  update(a, valid) {
    const done = [];
    // held(group, name, cond): cond has been true for holdFrames frames in a row.
    const held = (g, name, cond) => (this.hold[g][name] = cond ? (this.hold[g][name] || 0) + 1 : 0) >= this.holdFrames;
    // A group whose landmarks drop out loses its half-done rep: state must not
    // carry across frames the model could not see.
    for (const g of ['jj', 'squat', 'sway', 'flex']) {
      if (!valid[g]) { this[g] = null; this.hold[g] = {}; }
    }

    if (valid.jj) {
      const armsDown = a.hsw1 < 30 && a.hsw2 < 30;
      const armsUp = a.hsw1 > 150 && a.hsw2 > 150;
      const legsTogether = a.sha1 > 170 && a.sha2 > 170;
      const legsApart = a.sha1 < 170 && a.sha2 < 170;
      const downTogether = held('jj', 'downTogether', armsDown && legsTogether);
      const downApart = held('jj', 'downApart', armsDown && legsApart);
      const upApart = held('jj', 'upApart', armsUp && legsApart);
      const upTogether = held('jj', 'upTogether', armsUp && legsTogether);
      if (downTogether) {
        if (this.jj === 'jjup1') done.push('Jumping Jack');
        this.jj = 'jjdown1';
      }
      if (downApart) {
        if (this.jj === 'jjup2') done.push('Jumping Jack');
        this.jj = 'jjdown2';
      }
      if (upApart && this.jj === 'jjdown1') this.jj = 'jjup1';
      if (upTogether && this.jj === 'jjdown2') this.jj = 'jjup2';
    }

    if (valid.squat) {
      const down = held('squat', 'down', a.hka1 <= 100 && a.hka2 <= 100);
      const up = held('squat', 'up', a.hka1 >= 160 && a.hka2 >= 160);
      if (down) this.squat = 'down';
      if (up && this.squat === 'down') {
        this.squat = 'up';
        done.push('Squat');
      }
    }

    if (valid.sway) {
      const neutral = held('sway', 'neutral', a.hsw1 < 30 && a.hsw2 < 30);
      // One arm straight out to the side (other arm down) moves the piece that
      // way from the player's point of view: landmark 1 is the player's left.
      const left = held('sway', 'left', a.csw1 > 150 && a.hsw2 < 30);
      const right = held('sway', 'right', a.csw2 > 150 && a.hsw1 < 30);
      if (neutral) this.sway = 'neutral';
      if (left) {
        if (this.sway === 'neutral') done.push('Sway Left');
        this.sway = 'left';
      }
      if (right) {
        if (this.sway === 'neutral') done.push('Sway Right');
        this.sway = 'right';
      }
    }

    if (valid.flex) {
      const up = held('flex', 'up', a.esh1 > 40 && a.esh2 > 40 && a.sew1 < 60 && a.sew2 < 60);
      const down = held('flex', 'down', a.esh1 < 60 && a.esh2 < 60 && a.sew1 > 120 && a.sew2 > 120);
      if (up) {
        if (this.flex !== 'up') done.push('Flex');
        this.flex = 'up';
      }
      if (down) this.flex = 'down';
    }

    return done;
  }
}
