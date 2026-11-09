# FITRIS: Fitness Meets Tetris

**FITRIS** turns your workout into a game of Tetris. Your webcam watches your body,
a pose model running in your browser recognizes exercises (squats, jumping jacks,
flexes, side sways), and each one is mapped to a Tetris control. Squat to hard-drop
a piece, do a jumping jack to rotate, hold an arm out to move, and try to clear
lines without topping out.

Everything runs on your device. There is no server: the video never leaves your
browser, only the name of each completed exercise reaches the game.

## Tech Stack

- **Game**: React + Vite
- **Pose detection**: MediaPipe Pose Landmarker for the web (WebAssembly, WebGL/GPU
  with a CPU fallback)
- **Hosting**: static files (GitHub Pages workflow included)

## How It Works

```
 webcam ──getUserMedia──▶ <video> ──every frame──▶ PoseLandmarker (33 landmarks)
                                                          │
                              joint angles (pixel space) ◀┘
                                         │
                     RepCounter: one state machine per exercise
                                         │  "Squat", "Flex", ...
                                         ▼
                                 Tetris game action
```

1. **`components/Camera.jsx`** asks for the webcam, runs the pose landmarker on each
   new video frame (`requestVideoFrameCallback`), draws the skeleton, and shows live
   fps, inference time and camera-to-input latency (from each frame's capture
   timestamp, where the browser provides it).
2. **`pose/landmarks.js`** turns landmarks into joint angles. Angles are computed in
   pixel space, since landmarks are normalized separately by width and height.
3. **`pose/reps.js`** gives each exercise its own state machine, so only a full rep
   counts (a half squat does nothing) and exercises can't reset each other.
4. **`App.jsx`** turns each completed rep into a fresh `{ exercise, seq }` event, so
   repeating the same exercise triggers every time, and **`components/Tetris.jsx`**
   applies it.

### Exercise → control mapping

| Exercise                         | Tetris action    | Keyboard     |
| -------------------------------- | ---------------- | ------------ |
| Left arm straight out to the side  | Move piece left  | ← Left arrow  |
| Right arm straight out to the side | Move piece right | → Right arrow |
| Jumping jack                     | Rotate piece     | ↑ Up arrow    |
| Squat                            | Hard drop        | Spacebar     |
| Flex (both arms)                 | Hold piece       | `C`          |
| —                                | Soft drop        | ↓ Down arrow  |

Keyboard controls always work, and touch screens get on-screen buttons, so you can
play without a webcam. The layout adapts from phones (portrait or landscape) to
desktops, and the game shows a ghost of where the falling piece will land.

## Project Structure

```
frontend/
  index.html
  vite.config.js
  src/
    App.jsx               # wires camera events into the game
    pose/
      detector.js         # loads MediaPipe (bundled WASM, GPU -> CPU fallback)
      landmarks.js        # landmark indices, in-frame checks, joint angles
      reps.js             # per-exercise rep state machines
      reps.test.js
    components/
      Camera.jsx          # webcam, detection loop, skeleton overlay, stats
      Tetris.jsx          # game state, controls, scoring
      GameGrid.jsx        # renders a grid + active piece
      helpers.js          # grid, tetrominoes, collision
      Tetris.test.jsx
.github/workflows/deploy.yml  # test, build, publish to GitHub Pages
```

## Running Locally

Requires **Node.js 20+**.

```bash
git clone https://github.com/KrishNalam/Project-FITRIS.git
cd Project-FITRIS/frontend
npm install
npm run dev        # http://localhost:5173
```

Click **Enable camera** and stand back far enough that your whole body is in frame.
The pose model (~6 MB) downloads the first time. Camera access needs `localhost` or
HTTPS.

```bash
npm test           # rep detection + game logic
npm run build      # static site in frontend/dist
```

## Deploying

The site is plain static files. With the included workflow, enable **Settings →
Pages → Source: GitHub Actions** and push to `main`; it tests, builds and publishes
`frontend/dist`. Asset paths are relative, so it works under `/Project-FITRIS/` or on
a custom domain.

## Notes & Limitations

- One player at a time, in a single browser tab.
- The pose model is fetched from Google's MediaPipe model storage; the WebAssembly
  runtime ships with the site.
- The original version (JamHacks 8) ran detection in Python/OpenCV and streamed
  events to the browser through a Flask server; it is in the git history.

## Credits

FITRIS started at **JamHacks 8** (2024), where it won, built with
[@yuvibirdi](https://github.com/yuvibirdi) and [@alhod](https://github.com/alhod).
The original hackathon code lives at [yuvibirdi/fitris](https://github.com/yuvibirdi/fitris).
It has since been rebuilt and is maintained by [@KrishNalam](https://github.com/KrishNalam).
