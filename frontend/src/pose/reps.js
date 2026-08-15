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
export class RepCounter {
  constructor() {
    this.jj = null;    // jumping jack: jjdown1 / jjup1 / jjdown2 / jjup2
    this.squat = null; // 'down' once the knees bend past 100 deg
    this.sway = null;  // 'neutral' with both arms down, else 'left' / 'right'
    this.flex = null;  // 'up' while flexing, 'down' once the arms are lowered
  }

  update(a, valid) {
    const done = [];

    if (valid.jj) {
      const armsDown = a.hsw1 < 30 && a.hsw2 < 30;
      const armsUp = a.hsw1 > 150 && a.hsw2 > 150;
      const legsTogether = a.sha1 > 170 && a.sha2 > 170;
      const legsApart = a.sha1 < 170 && a.sha2 < 170;
      if (armsDown && legsTogether) {
        if (this.jj === 'jjup1') done.push('Jumping Jack');
        this.jj = 'jjdown1';
      }
      if (armsDown && legsApart) {
        if (this.jj === 'jjup2') done.push('Jumping Jack');
        this.jj = 'jjdown2';
      }
      if (armsUp && legsApart && this.jj === 'jjdown1') this.jj = 'jjup1';
      if (armsUp && legsTogether && this.jj === 'jjdown2') this.jj = 'jjup2';
    }

    if (valid.squat) {
      if (a.hka1 <= 100 && a.hka2 <= 100) this.squat = 'down';
      if (a.hka1 >= 160 && a.hka2 >= 160 && this.squat === 'down') {
        this.squat = 'up';
        done.push('Squat');
      }
    }

    if (valid.sway) {
      if (a.hsw1 < 30 && a.hsw2 < 30) this.sway = 'neutral';
      if (a.csw1 > 150 && a.hsw2 < 30) {
        if (this.sway === 'neutral') done.push('Sway Right');
        this.sway = 'right';
      }
      if (a.csw2 > 150 && a.hsw1 < 30) {
        if (this.sway === 'neutral') done.push('Sway Left');
        this.sway = 'left';
      }
    }

    if (valid.flex) {
      if (a.esh1 > 40 && a.esh2 > 40 && a.sew1 < 60 && a.sew2 < 60) {
        if (this.flex !== 'up') done.push('Flex');
        this.flex = 'up';
      }
      if (a.esh1 < 60 && a.esh2 < 60 && a.sew1 > 120 && a.sew2 > 120) this.flex = 'down';
    }

    return done;
  }
}
