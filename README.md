# FITRIS: Fitness Meets Tetris

**FITRIS** turns your workout into a game of Tetris. A webcam watches your body, an
AI pose model recognizes exercises (squats, jumping jacks, flexes, side sways), and
each exercise is mapped to a Tetris control. Do a squat to hard-drop a piece, a
jumping jack to rotate, sway left/right to move — and try to clear lines without
topping out.

## Tech Stack

- **Frontend**: ReactJS (Create React App)
- **Backend**: Flask (Python)
- **Pose / Exercise Detection**: OpenCV + MediaPipe Pose

## How It Works

FITRIS is three small programs connected by HTTP — the detector pushes events to
the backend, and the backend streams them to the browser:

```
 ┌──────────────────────┐  POST /exercise  ┌────────────┐  SSE /events   ┌─────────────┐
 │ exercise_detection.py │ ───────────────▶ │  server.py │ ─────────────▶ │  React app  │
 │ (webcam + MediaPipe)  │   {exercise}     │  (Flask,   │   {exercise,   │  (Tetris)   │
 └──────────────────────┘                  │ in-memory) │     seq}        └─────────────┘
                                            └────────────┘
```

1. **`exercise_detection.py`** captures your webcam with OpenCV and runs MediaPipe
   Pose to get body landmarks. It computes joint angles each frame and uses simple
   rules (e.g. knee angle for squats, arm/leg angles for jumping jacks) to detect a
   completed rep. When it detects one, it **POSTs** the exercise name to
   `http://localhost:5000/exercise` (e.g. `{"exercise": "Squat"}`). Press **`q`** in
   the webcam window to quit.

2. **`server.py`** is a Flask server holding the latest exercise in memory with an
   incrementing `seq`. `POST /exercise` records a detection; `GET /events` is a
   **Server-Sent Events** stream that pushes each detection to subscribers as
   `{ "exercise": "Squat", "seq": 7 }`. It runs on `http://localhost:5000`.

3. **The React app** (`src/`) subscribes to `/events` with `EventSource` (the dev
   server proxies `/events` to Flask via the `"proxy"` field in `package.json`).
   Every event — identified by its unique `seq` — triggers the matching action, so
   repeating the same exercise registers every time.

### Exercise → control mapping

| Exercise      | Tetris action      | Keyboard equivalent |
| ------------- | ------------------ | ------------------- |
| Sway Left     | Move piece left    | ← Left arrow        |
| Sway Right    | Move piece right   | → Right arrow       |
| Jumping Jack  | Rotate piece       | ↑ Up arrow          |
| Squat         | Hard drop          | Spacebar            |
| Flex          | Hold piece         | `C`                 |
| —             | Soft drop          | ↓ Down arrow        |

Keyboard controls are always available, so you can play (and test) the game without
a webcam.

## Project Structure

```
backend/
  exercise_detection.py # webcam pose detection -> POST /exercise
  server.py             # Flask API: POST /exercise, SSE GET /events
  requirements.txt      # Python dependencies
frontend/
  package.json          # React app + dev-server proxy to Flask
  public/
  src/                  # React Tetris game
    App.js              # subscribes to /events and feeds the game
    components/
      Tetris.js         # game state, controls, scoring
      GameGrid.js       # renders the grid + active piece
      helpers.js        # grid + tetromino + collision helpers
```

## Installation

Requirements: **Node.js** and **Python 3.10–3.12** (MediaPipe wheels may not yet be
available on the very newest Python releases).

1. Clone and enter the repo:

   ```bash
   git clone https://github.com/yuvibirdi/fitris.git
   cd fitris
   ```

2. Install the Python dependencies (a virtualenv is recommended):

   ```bash
   python -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```

3. Install the frontend dependencies:

   ```bash
   cd frontend
   npm install
   cd ..
   ```

## Running the App

Open **three** terminals from the project root.

1. **Start the Flask backend** (serves `/exercise` on port 5000):

   ```bash
   source .venv/bin/activate      # if not already active
   python backend/server.py
   ```

2. **Start the React frontend** (opens on port 3000, proxies to Flask):

   ```bash
   cd frontend
   npm start
   ```

   Then open `http://localhost:3000`.

3. **Start exercise detection** (opens a webcam window):

   ```bash
   source .venv/bin/activate      # if not already active
   python backend/exercise_detection.py
   ```

   Stand back far enough that your whole body is visible. Press **`q`** in the
   webcam window to stop detection.

## Usage

- Make sure your webcam is connected and not in use by another app.
- Stand so your full body is in frame for the pose model to track you.
- Perform exercises to control the falling pieces (see the mapping table above).
- Prefer to test without a camera? Just skip step 3 and use the keyboard.
- Clear lines for points; the high score is saved in your browser's local storage.

## Notes & Limitations

- Detections flow detector → backend (`POST`) → browser (SSE). The backend keeps the
  latest exercise in memory only — restart it and that state is gone (the game just
  waits for the next detection), which is fine for a single local session.
- The detector reads `FITRIS_SERVER` (default `http://localhost:5000`) if you need to
  point it at a backend on another host/port.
- High knees and a couple of other moves are present in the detection code but
  currently commented out.
