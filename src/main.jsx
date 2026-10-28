import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { createStoryboard, makeLocalStoryboard } from './lib/ai.js';
import './style.css';

const W = 540;
const H = 960;
const FPS = 12;
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';

function drawFrame(ctx, scene, sceneIndex, frame, frameCount) {
  const progress = frame / Math.max(1, frameCount - 1);
  const hue = [250, 330, 28][sceneIndex % 3];
  const gradient = ctx.createLinearGradient(0, 0, W * (0.7 + progress * 0.2), H);
  gradient.addColorStop(0, `hsl(${hue} 35% 22%)`);
  gradient.addColorStop(0.5, `hsl(${(hue + 24) % 360} 52% 48%)`);
  gradient.addColorStop(1, '#141725');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  const sunX = W * (0.72 - progress * 0.16);
  const sunY = H * (0.3 + progress * 0.06);
  const radius = 100 + Math.sin(progress * Math.PI) * 12;
  const glow = ctx.createRadialGradient(sunX, sunY, 3, sunX, sunY, radius * 1.8);
  glow.addColorStop(0, 'rgba(255,238,190,.95)');
  glow.addColorStop(0.35, 'rgba(255,196,146,.55)');
  glow.addColorStop(1, 'rgba(255,196,146,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - radius * 2, sunY - radius * 2, radius * 4, radius * 4);

  ctx.fillStyle = 'rgba(17, 20, 34, .62)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.68);
  ctx.quadraticCurveTo(W * 0.3, H * (0.57 + progress * 0.02), W * 0.62, H * 0.72);
  ctx.quadraticCurveTo(W * 0.83, H * 0.78, W, H * 0.65);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('CRAYONS REEL STUDIO', 42, 76);
  ctx.fillStyle = '#d8ff76';
  ctx.fillRect(42, 104, 42, 4);

  const caption = (scene.caption || scene.title || 'A story worth sharing').trim();
  const words = caption.split(/\s+/);
  const lines = [];
  let line = '';
  ctx.font = '800 48px system-ui, sans-serif';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > W - 84 && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  const visibleLines = lines.slice(0, 4);
  const startY = H * 0.76 - (visibleLines.length - 1) * 29;
  ctx.fillStyle = '#fffaf1';
  ctx.font = '800 48px system-ui, sans-serif';
  visibleLines.forEach((text, i) => ctx.fillText(text, 42, startY + i * 58, W - 84));

  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.font = '16px system-ui, sans-serif';
  const label = (scene.title || `Scene ${sceneIndex + 1}`).slice(0, 48);
  ctx.fillText(label.toUpperCase(), 42, H - 48);
  ctx.fillStyle = '#d8ff76';
  ctx.fillRect(42, H - 30, (W - 84) * progress, 3);
}

async function buildMp4(scenes, audioFile, onProgress) {
  const ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => onProgress(Math.max(0, Math.min(100, Math.round(progress * 100)))));
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm')
  });

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('This browser cannot create the video canvas.');

  let frameNumber = 0;
  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    const scene = scenes[sceneIndex];
    const count = Math.max(36, Math.min(96, Math.round((Number(scene.seconds) || 5) * FPS)));
    for (let frame = 0; frame < count; frame += 1) {
      drawFrame(ctx, scene, sceneIndex, frame, count);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('Could not render a video frame.')),
        'image/jpeg', 0.88
      ));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await ffmpeg.writeFile(`frame-${String(frameNumber).padStart(4, '0')}.jpg`, bytes);
      frameNumber += 1;
      if (frameNumber % 12 === 0) onProgress(Math.round((frameNumber / (scenes.length * 96)) * 20));
    }
  }

  const args = ['-framerate', String(FPS), '-i', 'frame-%04d.jpg'];
  if (audioFile) {
    const extension = (audioFile.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
    const audioName = `user-audio.${['mp3','wav','m4a','aac','ogg','flac'].includes(extension) ? extension : 'mp3'}`;
    await ffmpeg.writeFile(audioName, new Uint8Array(await audioFile.arrayBuffer()));
    args.push('-i', audioName, '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-c:a', 'aac', '-b:a', '128k');
  }
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'reel.mp4');
  const result = await ffmpeg.exec(args);
  if (result !== 0) throw new Error('MP4 encoding failed. Try a shorter reel or a supported audio file.');
  const data = await ffmpeg.readFile('reel.mp4');
  return new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)], { type: 'video/mp4' });
}

function App() {
  const [prompt, setPrompt] = useState('A dreamy cinematic journey through Kerala at golden hour');
  const [scenes, setScenes] = useState(makeLocalStoryboard('A dreamy cinematic journey through Kerala at golden hour'));
  const [status, setStatus] = useState('Local storyboard ready. No AI key is needed for MP4 export.');
  const [provider, setProvider] = useState('Local template');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioFile, setAudioFile] = useState(null);

  async function handleCreate(event) {
    event.preventDefault();
    if (!prompt.trim()) { setStatus('Add a prompt to continue.'); return; }
    setBusy(true); setStatus('Checking free AI availability…');
    try {
      const result = await createStoryboard(prompt);
      setScenes(result.scenes);
      setProvider(result.provider);
      setStatus(result.fallback ? result.reason : `Storyboard created with ${result.provider}. Free-tier fallback only; no paid API fallback.`);
    } finally { setBusy(false); }
  }

  function updateScene(index, field, value) {
    setScenes((current) => current.map((scene, i) => i === index ? { ...scene, [field]: value } : scene));
  }

  async function handleExport() {
    setBusy(true); setProgress(0);
    setStatus('Preparing browser-side MP4 export. The video is rendered on this device…');
    try {
      const blob = await buildMp4(scenes, audioFile, setProgress);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'crayons-ai-reel.mp4'; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setProgress(100);
      setStatus('MP4 export complete. The file was created on this device; no video-rendering server was used.');
    } catch (error) {
      setStatus(`Export could not finish: ${error?.message || 'Unknown browser error'} Check the connection for the one-time FFmpeg download, then try again.`);
    } finally { setBusy(false); }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Crayons AI Reel Studio home"><span className="brand-mark">C</span><span>CRAYONS <b>STUDIO</b></span></a>
        <span className="preview-pill"><span /> FREE-FIRST WORKSPACE</span>
      </header>
      <section className="hero" id="top">
        <p className="eyebrow">YOUR IDEA, IN MOTION</p>
        <h1>Make a little<br /><span>movie magic.</span></h1>
        <p className="intro">Build a storyboard, refine the captions, add your own audio, and export a real vertical MP4 directly in your browser. AI is optional; paid fallback is disabled.</p>
      </section>
      <section className="workspace" aria-label="Reel creation workspace">
        <form className="prompt-panel" onSubmit={handleCreate}>
          <div className="panel-heading"><span className="step">01</span><div><h2>Describe your Reel</h2><p>Start with a mood, a place, or a story.</p></div></div>
          <label htmlFor="prompt">YOUR PROMPT</label>
          <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={1200} placeholder="A quiet coastal town wakes up at sunrise…" />
          <div className="prompt-meta"><span>Be vivid. Think cinematic.</span><span>{prompt.length}/1200</span></div>
          <button className="primary" type="submit" disabled={busy}>Create storyboard <span aria-hidden="true">↗</span></button>
          <label className="audio-label" htmlFor="audio">OPTIONAL AUDIO TRACK</label>
          <input id="audio" className="audio-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={(event) => setAudioFile(event.target.files?.[0] || null)} />
          <p className="tiny-note">{audioFile ? `Audio selected: ${audioFile.name}` : 'Use audio you have the rights to use. Audio stays on your device.'}</p>
          <button className="export-button" type="button" onClick={handleExport} disabled={busy || scenes.length === 0}>{busy ? 'Working…' : 'Export real MP4'} <span>↓</span></button>
          {busy && <div className="progress-track" aria-label="Export progress"><span style={{ width: `${progress}%` }} /></div>}
          <p className="status" role="status">{status}</p>
          <p className="tiny-note">Free AI endpoint: {provider}. If unavailable or quota-limited, local templates are used. No paid API is called automatically.</p>
        </form>
        <aside className="preview-panel">
          <div className="panel-heading"><span className="step">02</span><div><h2>Your storyboard</h2><p>Edit captions before exporting</p></div></div>
          <div className="scene-list">
            {scenes.map((scene, index) => (
              <article className="scene-card" key={index}>
                <div className="scene-art" style={{ '--scene-hue': [252, 326, 32][index % 3] }}><span>SCENE {String(index + 1).padStart(2, '0')}</span><b>{String(scene.seconds || 5)} SEC</b></div>
                <div className="scene-fields">
                  <label htmlFor={`scene-title-${index}`}>SCENE TITLE</label>
                  <input id={`scene-title-${index}`} value={scene.title || ''} maxLength={80} onChange={(event) => updateScene(index, 'title', event.target.value)} />
                  <label htmlFor={`scene-caption-${index}`}>CAPTION</label>
                  <textarea id={`scene-caption-${index}`} rows={2} value={scene.caption || ''} maxLength={140} onChange={(event) => updateScene(index, 'caption', event.target.value)} />
                  <label htmlFor={`scene-seconds-${index}`}>DURATION (SECONDS)</label>
                  <select id={`scene-seconds-${index}`} value={scene.seconds || 5} onChange={(event) => updateScene(index, 'seconds', Number(event.target.value))}>
                    {[3,4,5,6,7,8].map((seconds) => <option key={seconds} value={seconds}>{seconds} sec</option>)}
                  </select>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
      <footer><span>Made for ideas that deserve a screen.</span><span>Browser-side MP4 · No automatic paid fallback</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
