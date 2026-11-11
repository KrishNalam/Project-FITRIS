// Offline accuracy eval: runs labelled clips through the same detector, angle
// code and RepCounter the game uses, sampling each clip at a fixed rate so the
// result does not depend on how fast this machine is.
import { loadLandmarker } from '../pose/detector';
import { RepCounter } from '../pose/reps';
import { frameAngles, validGroups } from '../pose/landmarks';
import { parseLabel, scoreClip, summarize } from './score';

const FPS = 30; // sample rate, like a typical webcam
const $ = (id) => document.getElementById(id);
let clock = 0; // VIDEO mode needs timestamps that keep increasing across clips
let dataset = [];

const once = (el, ev) => new Promise((res, rej) => {
  const ok = () => { el.removeEventListener('error', bad); res(); };
  const bad = () => { el.removeEventListener(ev, ok); rej(new Error('this browser cannot decode the video')); };
  el.addEventListener(ev, ok, { once: true });
  el.addEventListener('error', bad, { once: true });
});

const openVideo = async (file) => {
  const v = document.createElement('video');
  v.muted = true;
  v.preload = 'auto';
  v.src = URL.createObjectURL(file);
  await once(v, 'loadeddata');
  if (!Number.isFinite(v.duration)) { // MediaRecorder WebM has no duration until you seek to the end
    v.currentTime = 1e9;
    await once(v, 'seeked');
  }
  return v;
};

const runClip = async (file, landmarker, onProgress) => {
  const v = await openVideo(file);
  const counter = new RepCounter();
  const events = [];
  const frames = [];
  for (let t = 0; t < v.duration; t += 1 / FPS) {
    v.currentTime = t;
    await once(v, 'seeked');
    clock += 1000 / FPS;
    const lm = landmarker.detectForVideo(v, clock).landmarks[0];
    if (!lm) { frames.push({ t, angles: null }); continue; }
    const angles = frameAngles(lm, v.videoWidth, v.videoHeight);
    const valid = validGroups(lm);
    const done = counter.update(angles, valid);
    frames.push({ t, angles, valid, done });
    done.forEach((ex) => events.push({ t, ex }));
    onProgress(t / v.duration);
  }
  URL.revokeObjectURL(v.src);
  return { events, frames };
};

const cell = (tr, text) => { tr.insertCell().textContent = text; };

$('files').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  const tbody = $('out').querySelector('tbody');
  tbody.innerHTML = '';
  $('out').hidden = false;
  $('summary').textContent = '';
  $('dl').disabled = true;
  dataset = [];
  $('status').textContent = 'Loading pose model...';
  const { landmarker, delegate } = await loadLandmarker();
  const scores = [];

  for (const [i, file] of files.entries()) {
    const label = parseLabel(file.name);
    const tr = tbody.insertRow();
    try {
      const { events, frames } = await runClip(file, landmarker, (p) => {
        $('status').textContent = `${i + 1}/${files.length} ${file.name}: ${Math.round(p * 100)}%`;
      });
      const counts = {};
      events.forEach(({ ex }) => { counts[ex] = (counts[ex] || 0) + 1; });
      const s = label && scoreClip(label, counts);
      if (s) scores.push(s);
      const others = Object.entries(counts).filter(([k]) => k !== label?.move).map(([k, n]) => `${k} ×${n}`);
      cell(tr, file.name);
      cell(tr, label?.move ?? '(no label)');
      cell(tr, label?.expected ?? '');
      cell(tr, label ? counts[label.move] || 0 : JSON.stringify(counts));
      cell(tr, s?.missed ?? '');
      cell(tr, s?.extra ?? '');
      cell(tr, others.join(', '));
      cell(tr, `${Math.round((100 * frames.filter((f) => !f.angles).length) / frames.length)}%`);
      cell(tr, events.map(({ t, ex }) => `${t.toFixed(1)} ${ex}`).join(', '));
      dataset.push({ file: file.name, label, fps: FPS, frames });
    } catch (err) {
      cell(tr, file.name);
      cell(tr, `error: ${err.message}`);
    }
  }

  landmarker.close();
  const sum = summarize(scores);
  $('status').textContent = `Done (${delegate}). ${files.length} clips, sampled at ${FPS} fps.`;
  $('summary').textContent = sum.expected
    ? `Recall ${(sum.recall * 100).toFixed(1)}% (${sum.detected}/${sum.expected} reps). ` +
      `False triggers: ${sum.falseTriggers} (${sum.extra} over-counts of the same move, ${sum.other} other moves).`
    : 'No labelled clips with expected reps.';
  console.table(scores);
  $('dl').disabled = false;
});

// Per-frame angles + labels: the training data for a learned classifier later.
$('dl').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dataset)], { type: 'application/json' }));
  a.download = 'fitris-eval-frames.json';
  a.click();
});
