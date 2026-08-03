"""Rep detection: joint angles per frame in, completed exercises out.

Kept free of OpenCV/MediaPipe so it can be tested with plain numbers.
Each exercise has its own state machine. They used to share one `stage`
variable, so the jumping-jack check (which runs every frame) overwrote a
squat's 'down' state whenever the arms were by the sides, and squats only
registered with the arms raised.
"""
import numpy as np


def calculate_angle(a, b, c):
    """Angle at joint b (degrees, 0-180) formed by points a-b-c."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    return 360 - angle if angle > 180.0 else angle


class RepCounter:
    """Feed one frame of angles to update(); it returns the exercises completed this frame.

    `angles` maps names to degrees: hsw1/hsw2 (hip-shoulder-wrist), sha1/sha2
    (shoulder-hip-ankle), hka1/hka2 (hip-knee-ankle), sew1/sew2
    (shoulder-elbow-wrist), csw1/csw2 (chest-shoulder-wrist), esh1/esh2
    (elbow-shoulder-hip). `valid` says which exercise groups had every
    landmark in frame.
    """

    def __init__(self):
        self.jj = None      # jumping jack: jjdown1 / jjup1 / jjdown2 / jjup2
        self.squat = None   # 'down' once the knees bend past 100 deg
        self.sway = None    # 'neutral' with both arms down, else 'left' / 'right'
        self.flex = None    # 'up' while flexing, 'down' once arms are lowered

    def update(self, a, valid):
        done = []

        if valid.get('jj'):
            arms_down = a['hsw1'] < 30 and a['hsw2'] < 30
            arms_up = a['hsw1'] > 150 and a['hsw2'] > 150
            legs_together = a['sha1'] > 170 and a['sha2'] > 170
            legs_apart = a['sha1'] < 170 and a['sha2'] < 170
            if arms_down and legs_together:
                if self.jj == 'jjup1':
                    done.append('Jumping Jack')
                self.jj = 'jjdown1'
            if arms_down and legs_apart:
                if self.jj == 'jjup2':
                    done.append('Jumping Jack')
                self.jj = 'jjdown2'
            if arms_up and legs_apart and self.jj == 'jjdown1':
                self.jj = 'jjup1'
            if arms_up and legs_together and self.jj == 'jjdown2':
                self.jj = 'jjup2'

        if valid.get('squat'):
            if a['hka1'] <= 100 and a['hka2'] <= 100:
                self.squat = 'down'
            if a['hka1'] >= 160 and a['hka2'] >= 160 and self.squat == 'down':
                self.squat = 'up'
                done.append('Squat')

        if valid.get('sway'):
            if a['hsw1'] < 30 and a['hsw2'] < 30:
                self.sway = 'neutral'
            if a['csw1'] > 150 and a['hsw2'] < 30:
                if self.sway == 'neutral':
                    done.append('Sway Right')
                self.sway = 'right'
            if a['csw2'] > 150 and a['hsw1'] < 30:
                if self.sway == 'neutral':
                    done.append('Sway Left')
                self.sway = 'left'

        if valid.get('flex'):
            if a['esh1'] > 40 and a['esh2'] > 40 and a['sew1'] < 60 and a['sew2'] < 60:
                if self.flex != 'up':
                    done.append('Flex')
                self.flex = 'up'
            if a['esh1'] < 60 and a['esh2'] < 60 and a['sew1'] > 120 and a['sew2'] > 120:
                self.flex = 'down'

        return done
