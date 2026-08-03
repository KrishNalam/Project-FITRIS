import os
import time
import urllib.request

import cv2
import mediapipe as mp
import requests
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

from reps import RepCounter, calculate_angle

SERVER_URL = os.environ.get("FITRIS_SERVER", "http://localhost:5000") + "/exercise"
MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
             "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task")
MODEL_PATH = os.environ.get(
    "FITRIS_MODEL",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "pose_landmarker_lite.task"),
)

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

# Landmarks each exercise needs in frame (normalized coords within -0.5..1.5).
GROUPS = {
    'jj':    [L_HIP, R_HIP, L_SHOULDER, R_SHOULDER, L_WRIST, R_WRIST, L_ANKLE, R_ANKLE],
    'squat': [L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE],
    'sway':  [L_SHOULDER, R_SHOULDER, L_WRIST, R_WRIST, L_ANKLE, R_ANKLE],
    'flex':  [L_ELBOW, R_ELBOW, L_SHOULDER, R_SHOULDER, L_WRIST, R_WRIST],
}


def ensure_model():
    """Download the pose model on first run (it is not committed to the repo)."""
    if not os.path.exists(MODEL_PATH):
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        print(f"Downloading pose model to {MODEL_PATH} ...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def in_frame(landmarks, idxs):
    return all(-0.5 <= landmarks[i].x <= 1.5 and -0.5 <= landmarks[i].y <= 1.5 for i in idxs)


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
        cv2.line(image, pts[i], pts[j], (245, 66, 230), 2)
    for pt in pts:
        cv2.circle(image, pt, 4, (245, 117, 66), -1)


def frame_angles(lm):
    p = lambda i: [lm[i].x, lm[i].y]
    chest = [(lm[L_SHOULDER].x + lm[R_SHOULDER].x) / 2, (lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2]
    ang = calculate_angle
    return {
        'hsw1': ang(p(L_HIP), p(L_SHOULDER), p(L_WRIST)),  'hsw2': ang(p(R_HIP), p(R_SHOULDER), p(R_WRIST)),
        'sha1': ang(p(L_SHOULDER), p(L_HIP), p(L_ANKLE)),  'sha2': ang(p(R_SHOULDER), p(R_HIP), p(R_ANKLE)),
        'hka1': ang(p(L_HIP), p(L_KNEE), p(L_ANKLE)),      'hka2': ang(p(R_HIP), p(R_KNEE), p(R_ANKLE)),
        'sew1': ang(p(L_SHOULDER), p(L_ELBOW), p(L_WRIST)), 'sew2': ang(p(R_SHOULDER), p(R_ELBOW), p(R_WRIST)),
        'csw1': ang(chest, p(L_SHOULDER), p(L_WRIST)),     'csw2': ang(chest, p(R_SHOULDER), p(R_WRIST)),
        'esh1': ang(p(L_ELBOW), p(L_SHOULDER), p(L_HIP)),  'esh2': ang(p(R_ELBOW), p(R_SHOULDER), p(R_HIP)),
    }


def main():
    ensure_model()
    opts = mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    counter = RepCounter()
    cap = cv2.VideoCapture(0)
    start = time.monotonic()  # VIDEO mode needs strictly increasing timestamps

    with mp_vision.PoseLandmarker.create_from_options(opts) as landmarker:
        while cap.isOpened():
            ret, image = cap.read()
            if not ret:
                break

            timestamp_ms = int((time.monotonic() - start) * 1000)
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            result = landmarker.detect_for_video(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), timestamp_ms)

            if result.pose_landmarks:
                lm = result.pose_landmarks[0]
                draw_landmarks(image, lm)
                valid = {name: in_frame(lm, idxs) for name, idxs in GROUPS.items()}
                for exercise in counter.update(frame_angles(lm), valid):
                    send_exercise(exercise)

            cv2.imshow('FITRIS - Exercise Detection (press q to quit)', image)
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == '__main__':
    main()
