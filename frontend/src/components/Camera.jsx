// Webcam + in-browser pose detection. Frames never leave the device: MediaPipe
// runs locally (WebAssembly + WebGL) and only exercise names reach the game.
import React, { useEffect, useRef, useState } from 'react';
import { loadLandmarker } from '../pose/detector';
import { RepCounter } from '../pose/reps';
import { CONNECTIONS, frameAngles, validGroups } from '../pose/landmarks';
import './Camera.css';

const drawPose = (ctx, lm, w, h) => {
  ctx.clearRect(0, 0, w, h);
  if (!lm) return;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f542e6';
  ctx.fillStyle = '#f57542';
  for (const [i, j] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(lm[i].x * w, lm[i].y * h);
    ctx.lineTo(lm[j].x * w, lm[j].y * h);
    ctx.stroke();
  }
  for (const p of lm) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, 2 * Math.PI);
    ctx.fill();
  }
};

const errorMessage = (err) => {
  if (err?.name === 'NotAllowedError') return 'Camera permission denied.';
  if (err?.name === 'NotFoundError') return 'No camera found.';
  return `Could not start detection: ${err?.message || err}`;
};

// Runs detection on every new video frame until the returned stop() is called.
const runDetection = ({ video, canvas, landmarker, onExercise, onStats }) => {
  const counter = new RepCounter();
  const ctx = canvas.getContext('2d');
  const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  let handle;
  let stopped = false;
  let lastTs = -1;
  let lastVideoTime = -1;
  let s = { t0: performance.now(), frames: 0, infer: 0, lat: 0, latN: 0 };

  const schedule = () => {
    handle = useRVFC
      ? video.requestVideoFrameCallback((now, meta) => onFrame(meta))
      : requestAnimationFrame(() => onFrame(null));
  };

  const onFrame = (meta) => {
    if (stopped) return;
    const ts = performance.now();
    // VIDEO mode needs increasing timestamps; without rVFC, skip repeated frames.
    if (ts <= lastTs || (!useRVFC && video.currentTime === lastVideoTime)) return schedule();
    lastTs = ts;
    lastVideoTime = video.currentTime;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (canvas.width !== w) { canvas.width = w; canvas.height = h; }

    const result = landmarker.detectForVideo(video, ts);
    const lm = result.landmarks[0];
    if (lm) counter.update(frameAngles(lm, w, h), validGroups(lm)).forEach(onExercise);
    const done = performance.now();
    drawPose(ctx, lm, w, h);

    s.frames += 1;
    s.infer += done - ts;
    // captureTime (Chrome) is when the camera captured the frame, on the same
    // clock as performance.now(): this is true camera-to-game-input latency.
    if (meta?.captureTime) { s.lat += done - meta.captureTime; s.latN += 1; }
    if (done - s.t0 >= 1000) {
      onStats({
        fps: (s.frames * 1000) / (done - s.t0),
        inferMs: s.infer / s.frames,
        latencyMs: s.latN ? s.lat / s.latN : null,
      });
      s = { t0: done, frames: 0, infer: 0, lat: 0, latN: 0 };
    }
    schedule();
  };

  schedule();
  return () => {
    stopped = true;
    if (useRVFC) video.cancelVideoFrameCallback(handle);
    else cancelAnimationFrame(handle);
  };
};

const Camera = ({ onExercise }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cleanupRef = useRef(null);
  const onExerciseRef = useRef(onExercise);
  const [status, setStatus] = useState('idle'); // idle | loading | on | error
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [delegate, setDelegate] = useState('');
  const [last, setLast] = useState('');

  useEffect(() => { onExerciseRef.current = onExercise; }, [onExercise]);
  useEffect(() => () => cleanupRef.current?.(), []);

  const start = async () => {
    setStatus('loading');
    let stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('this page needs HTTPS (or localhost) to use the camera');
      }
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      const loaded = await loadLandmarker();
      const stop = runDetection({
        video,
        canvas: canvasRef.current,
        landmarker: loaded.landmarker,
        onExercise: (ex) => { setLast(ex); onExerciseRef.current(ex); },
        onStats: setStats,
      });
      cleanupRef.current = () => {
        stop();
        loaded.landmarker.close();
        stream.getTracks().forEach((t) => t.stop());
      };
      setDelegate(loaded.delegate);
      setStatus('on');
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop());
      setError(errorMessage(err));
      setStatus('error');
    }
  };

  return (
    <div className="camera-panel">
      <h2>CAMERA</h2>
      <div className={`camera-view ${status === 'on' ? '' : 'hidden'}`}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      {status === 'idle' && (
        <>
          <button className="play" onClick={start}>Enable camera</button>
          <p className="camera-note">Runs on your device. Video is never uploaded.</p>
        </>
      )}
      {status === 'loading' && <p className="camera-note">Loading pose model...</p>}
      {status === 'error' && (
        <>
          <p className="camera-note">{error}</p>
          <button className="play" onClick={start}>Try again</button>
        </>
      )}
      {status === 'on' && (
        <>
          <p className="camera-last">{last || 'Do a move!'}</p>
          {stats && (
            <p className="camera-stats" data-testid="camera-stats">
              {stats.fps.toFixed(0)} fps · {stats.inferMs.toFixed(0)} ms infer
              {stats.latencyMs != null && ` · ${stats.latencyMs.toFixed(0)} ms latency`}
              {` · ${delegate}`}
            </p>
          )}
        </>
      )}
      <p className="camera-note">Keys: left/right move · up rotate · down soft drop · space drop · C hold</p>
    </div>
  );
};

export default Camera;
