import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [prompt, setPrompt] = useState('A dreamy cinematic journey through Kerala at golden hour');
  const [status, setStatus] = useState('Ready to shape your idea');
  const [script, setScript] = useState('');
  const [busy, setBusy] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');

  async function handleCreate(event) {
    event.preventDefault();
    if (!prompt.trim()) {
      setStatus('Add a prompt to continue.');
      return;
    }
    setBusy('script');
    setError('');
    setStatus('Generating your script and storyboard…');
    try {
      const response = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Script generation failed.');
      setScript(data.text);
      setStatus('AI script and storyboard ready.');
    } catch (err) {
      setStatus('Script generation needs configuration.');
      setError(err.message || 'Could not generate the script.');
    } finally {
      setBusy('');
    }
  }

  async function handleVideo() {
    if (!prompt.trim()) {
      setError('Add a prompt before generating a video.');
      return;
    }
    setBusy('video');
    setError('');
    setStatus('Requesting video generation. This can take several minutes…');
    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Video generation failed.');
      }
      const blob = await response.blob();
      if (!blob.type.startsWith('video/')) throw new Error('The provider did not return a video file.');
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(URL.createObjectURL(blob));
      setStatus('Video generated. Preview it below.');
    } catch (err) {
      setStatus('Video generation is not enabled yet.');
      setError(err.message || 'Could not generate the video.');
    } finally {
      setBusy('');
    }
  }

  function downloadBrief() {
    const brief = `Crayons AI Reel Studio — concept brief\n\nPrompt: ${prompt.trim()}\n\nAI script / storyboard:\n${script || 'Not generated yet.'}\n\nTarget length: 30 seconds\nVideo status: ${videoUrl ? 'Generated in this session' : 'Not generated'}\n`;
    const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'crayons-reel-concept.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Crayons AI Reel Studio home">
          <span className="brand-mark">C</span>
          <span>CRAYONS <b>STUDIO</b></span>
        </a>
        <span className="preview-pill"><span /> AI WORKSPACE · PREVIEW</span>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">YOUR IDEA, IN MOTION</p>
        <h1>Make a little<br /><span>movie magic.</span></h1>
        <p className="intro">Turn a prompt into a Reel script, shot list, and—when a video provider is configured—an actual generated clip.</p>
      </section>

      <section className="workspace" aria-label="Reel concept workspace">
        <form className="prompt-panel" onSubmit={handleCreate}>
          <div className="panel-heading"><span className="step">01</span><div><h2>Describe your Reel</h2><p>Give your idea a mood, a place, or a story.</p></div></div>
          <label htmlFor="prompt">YOUR PROMPT</label>
          <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={1200} placeholder="A quiet coastal town wakes up at sunrise…" />
          <div className="prompt-meta"><span>Be vivid. Think cinematic.</span><span>{prompt.length}/1200</span></div>
          <button className="primary" type="submit" disabled={!!busy}>{busy === 'script' ? 'Writing your Reel…' : 'Generate script & storyboard'} <span aria-hidden="true">↗</span></button>
          <button className="secondary" type="button" onClick={handleVideo} disabled={!!busy}>{busy === 'video' ? 'Generating video…' : 'Generate actual video'}</button>
          <button className="secondary" type="button" onClick={downloadBrief}>Download concept brief</button>
          <p className="status" role="status">{status}</p>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="provider-note">Text AI uses a free-model router when an OpenRouter key is configured. Video generation requires a compatible Hugging Face Inference Provider; video is not guaranteed to be free.</p>
        </form>

        <aside className="preview-panel">
          <div className="panel-heading"><span className="step">02</span><div><h2>Reel preview</h2><p>{videoUrl ? 'Generated video' : 'Your 9:16 canvas'}</p></div></div>
          {videoUrl ? (
            <video className="generated-video" controls playsInline src={videoUrl}>Your browser does not support video playback.</video>
          ) : (
            <div className="reel-frame">
              <div className="frame-orbit orbit-one" /><div className="frame-orbit orbit-two" />
              <div className="frame-sun" />
              <div className="frame-horizon" />
              <div className="frame-copy"><span>YOUR NEXT STORY</span><strong>Imagine<br />what's next.</strong><small>30 SEC · VERTICAL</small></div>
              <span className="play-icon" aria-hidden="true">▶</span>
            </div>
          )}
          <div className="preview-foot"><span><i /> {videoUrl ? 'Generated clip' : 'Concept canvas'}</span><span>9:16 · 30 sec target</span></div>
        </aside>
      </section>

      {script && <section className="script-panel" aria-live="polite"><div className="panel-heading"><span className="step">03</span><div><h2>Your AI script & storyboard</h2><p>Review and refine before production.</p></div></div><pre>{script}</pre></section>}

      <footer><span>Made for ideas that deserve a screen.</span><span>Free-tier limits apply · No Supabase persistence</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
