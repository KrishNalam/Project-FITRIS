import os
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
import numpy as np
import time
import requests

SERVER_URL = os.environ.get("FITRIS_SERVER", "http://localhost:5000") + "/exercise"
MODEL_PATH = os.environ.get("FITRIS_MODEL", "/tmp/pose_landmarker_lite.task")

# BlazePose landmark indices
L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW,    R_ELBOW    = 13, 14
L_WRIST,    R_WRIST    = 15, 16
L_HIP,      R_HIP      = 23, 24
L_KNEE,     R_KNEE     = 25, 26
L_ANKLE,    R_ANKLE    = 27, 28

# BlazePose connections (subset used for drawing)
POSE_CONNECTIONS = [
    (L_SHOULDER, R_SHOULDER), (L_SHOULDER, L_ELBOW), (L_ELBOW, L_WRIST),
    (R_SHOULDER, R_ELBOW), (R_ELBOW, R_WRIST),
    (L_SHOULDER, L_HIP), (R_SHOULDER, R_HIP), (L_HIP, R_HIP),
    (L_HIP, L_KNEE), (L_KNEE, L_ANKLE), (R_HIP, R_KNEE), (R_KNEE, R_ANKLE),
]

jjcounter = sqcounter = hkcounter = swcounter = flcounter = 0
stage = None

webcam_lower_bound = -0.5
webcam_upper_bound = 1.5


def calculate_angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360 - angle
    return angle


def check_validity(land_marks):
    for i in land_marks:
        if i[0] < webcam_lower_bound or i[0] > webcam_upper_bound or \
           i[1] < webcam_lower_bound or i[1] > webcam_upper_bound:
            return False
    return True


def send_exercise(ex_name):
    print(f'ex_name: {ex_name}')
    try:
        requests.post(SERVER_URL, json={"exercise": ex_name}, timeout=1)
    except requests.RequestException as err:
        print(f'Failed to send "{ex_name}" to {SERVER_URL}: {err}')


def draw_landmarks(image, landmarks):
    h, w = image.shape[:2]
    pts = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
    for i, j in POSE_CONNECTIONS:
        if i < len(pts) and j < len(pts):
            cv2.line(image, pts[i], pts[j], (245, 66, 230), 2)
    for pt in pts:
        cv2.circle(image, pt, 4, (245, 117, 66), -1)


def xy(lm):
    return [lm.x, lm.y]


base_opts = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
opts = mp_vision.PoseLandmarkerOptions(
    base_options=base_opts,
    running_mode=mp_vision.RunningMode.VIDEO,
    num_poses=1,
    min_pose_detection_confidence=0.5,
    min_pose_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)

cap = cv2.VideoCapture(0)
start_ms = int(time.time() * 1000)

with mp_vision.PoseLandmarker.create_from_options(opts) as landmarker:
    while cap.isOpened():
        ret, image = cap.read()
        if not ret:
            break

        timestamp_ms = int(time.time() * 1000) - start_ms
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect_for_video(mp_image, timestamp_ms)

        if result.pose_landmarks:
            landmarks = result.pose_landmarks[0]
            draw_landmarks(image, landmarks)

            try:
                shoulder1 = xy(landmarks[L_SHOULDER])
                shoulder2 = xy(landmarks[R_SHOULDER])
                elbow1    = xy(landmarks[L_ELBOW])
                elbow2    = xy(landmarks[R_ELBOW])
                wrist1    = xy(landmarks[L_WRIST])
                wrist2    = xy(landmarks[R_WRIST])
                hip1      = xy(landmarks[L_HIP])
                hip2      = xy(landmarks[R_HIP])
                knee1     = xy(landmarks[L_KNEE])
                knee2     = xy(landmarks[R_KNEE])
                ankle1    = xy(landmarks[L_ANKLE])
                ankle2    = xy(landmarks[R_ANKLE])
                chest     = [(shoulder1[0]+shoulder2[0])/2, (shoulder1[1]+shoulder2[1])/2]

                hip_shoulder_wrist1  = calculate_angle(hip1,      shoulder1, wrist1)
                hip_shoulder_wrist2  = calculate_angle(hip2,      shoulder2, wrist2)
                shoulder_hip_ankle1  = calculate_angle(shoulder1, hip1,      ankle1)
                shoulder_hip_ankle2  = calculate_angle(shoulder2, hip2,      ankle2)
                hip_knee_ankle1      = calculate_angle(hip1,      knee1,     ankle1)
                hip_knee_ankle2      = calculate_angle(hip2,      knee2,     ankle2)
                shoulder_elbow_wrist1 = calculate_angle(shoulder1, elbow1,   wrist1)
                shoulder_elbow_wrist2 = calculate_angle(shoulder2, elbow2,   wrist2)
                chest_shoulder_wrist1 = calculate_angle(chest,     shoulder1, wrist1)
                chest_shoulder_wrist2 = calculate_angle(chest,     shoulder2, wrist2)
                elbow_shoulder_hip1  = calculate_angle(elbow1,    shoulder1, hip1)
                elbow_shoulder_hip2  = calculate_angle(elbow2,    shoulder2, hip2)

                # Jumping jacks
                jj_marks = [hip1, hip2, shoulder1, shoulder2, wrist1, wrist2, ankle1, ankle2]
                if check_validity(jj_marks):
                    if hip_shoulder_wrist1 < 30 and hip_shoulder_wrist2 < 30 and \
                       shoulder_hip_ankle1 > 170 and shoulder_hip_ankle2 > 170:
                        if stage == 'jjup1':
                            jjcounter += 1
                            send_exercise("Jumping Jack")
                        stage = 'jjdown1'
                    if hip_shoulder_wrist1 < 30 and hip_shoulder_wrist2 < 30 and \
                       shoulder_hip_ankle1 < 170 and shoulder_hip_ankle2 < 170:
                        if stage == 'jjup2':
                            jjcounter += 1
                            send_exercise("Jumping Jack")
                        stage = 'jjdown2'
                    if hip_shoulder_wrist1 > 150 and hip_shoulder_wrist2 > 150 and \
                       shoulder_hip_ankle1 < 170 and shoulder_hip_ankle2 < 170 and stage == 'jjdown1':
                        stage = 'jjup1'
                    if hip_shoulder_wrist1 > 150 and hip_shoulder_wrist2 > 150 and \
                       shoulder_hip_ankle1 > 170 and shoulder_hip_ankle2 > 170 and stage == 'jjdown2':
                        stage = 'jjup2'

                # Squats
                sq_marks = [hip1, hip2, knee1, knee2, ankle1, ankle2]
                if check_validity(sq_marks):
                    if hip_knee_ankle1 <= 100 and hip_knee_ankle2 <= 100:
                        stage = 'sqdown'
                    if hip_knee_ankle1 >= 160 and hip_knee_ankle2 >= 160 and stage == 'sqdown':
                        stage = 'squp'
                        sqcounter += 1
                        send_exercise("Squat")

                # Sways
                sway_marks = [chest, shoulder1, shoulder2, wrist1, wrist2, ankle1, ankle2]
                if check_validity(sway_marks):
                    if chest_shoulder_wrist1 > 150 and hip_shoulder_wrist2 < 30:
                        if stage in ('jjdown1', 'jjdown2'):
                            swcounter += 1
                            send_exercise("Sway Right")
                        stage = "swright"
                    if chest_shoulder_wrist2 > 150 and hip_shoulder_wrist1 < 30:
                        if stage in ('jjdown1', 'jjdown2'):
                            swcounter += 1
                            send_exercise("Sway Left")
                        stage = "swleft"

                # Flex
                flex_marks = [elbow1, elbow2, shoulder1, shoulder2, wrist1, wrist2]
                if check_validity(flex_marks):
                    if elbow_shoulder_hip1 > 40 and elbow_shoulder_hip2 > 40 and \
                       shoulder_elbow_wrist1 < 60 and shoulder_elbow_wrist2 < 60:
                        if stage != 'flexup':
                            flcounter += 1
                            send_exercise("Flex")
                            stage = "flexup"
                    if elbow_shoulder_hip1 < 60 and elbow_shoulder_hip2 < 60 and \
                       shoulder_elbow_wrist1 > 120 and shoulder_elbow_wrist2 > 120:
                        if stage == "flexup":
                            flcounter += 1
                            stage = "flexdown"

            except Exception as e:
                pass

        cv2.imshow('FITRIS - Exercise Detection (press q to quit)', image)
        if cv2.waitKey(10) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()
