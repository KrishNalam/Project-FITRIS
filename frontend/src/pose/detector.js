// Loads MediaPipe's pose landmarker in the browser. The WebAssembly runtime is
// bundled with the site (no CDN, so it always matches the installed package);
// the model is fetched from Google's MediaPipe model storage.
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

const create = (delegate) =>
  PoseLandmarker.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }
  );

// Prefer the GPU (WebGL); fall back to CPU where it is unavailable.
export const loadLandmarker = async () => {
  try {
    return { landmarker: await create('GPU'), delegate: 'GPU' };
  } catch {
    return { landmarker: await create('CPU'), delegate: 'CPU' };
  }
};
