import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [prompt, setPrompt] = useState('A dreamy cinematic journey through Kerala at golden hour');
  const [status, setStatus] = useState('Ready to shape your idea');

  function handleCreate(event) {
    event.preventDefault();
    if (!prompt.trim()) {
      setStatus('Add a prompt to continue.');
      return;
    }
    setStatus('Demo only — real AI video generation is not connected yet.');
  }

  function downloadBrief() {
    const brief = `Crayons AI Reel Studio — concept brief\n\nPrompt: ${prompt.trim()}\nTarget length: 30 seconds\nStatus: Concept only; no video generated.\n`;
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
        <span className="preview-pill"><span /> STARTER PREVIEW</span>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">YOUR IDEA, IN MOTION</p>
        <h1>Make a little<br /><span>movie magic.</span></h1>
        <p className="intro">Shape your next 30-second Reel. Start with a prompt, refine the concept, and build toward your first frame.</p>
      </section>

      <section className="workspace" aria-label="Reel concept workspace">
        <form className="prompt-panel" onSubmit={handleCreate}>
          <div className="panel-heading"><span className="step">01</span><div><h2>Describe your Reel</h2><p>Give your idea a mood, a place, or a story.</p></div></div>
          <label htmlFor="prompt">YOUR PROMPT</label>
          <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={1200} placeholder="A quiet coastal town wakes up at sunrise…" />
          <div className="prompt-meta"><span>Be vivid. Think cinematic.</span><span>{prompt.length}/1200</span></div>
          <button className="primary" type="submit">Create concept <span aria-hidden="true">↗</span></button>
          <button className="secondary" type="button" onClick={downloadBrief}>Download concept brief</button>
          <p className="status" role="status">{status}</p>
        </form>

        <aside className="preview-panel">
          <div className="panel-heading"><span className="step">02</span><div><h2>Reel preview</h2><p>Your 9:16 canvas</p></div></div>
          <div className="reel-frame">
            <div className="frame-orbit orbit-one" /><div className="frame-orbit orbit-two" />
            <div className="frame-sun" />
            <div className="frame-horizon" />
            <div className="frame-copy"><span>YOUR NEXT STORY</span><strong>Imagine<br />what's next.</strong><small>30 SEC · VERTICAL</small></div>
            <span className="play-icon" aria-hidden="true">▶</span>
          </div>
          <div className="preview-foot"><span><i /> Concept canvas</span><span>9:16 · 30 sec</span></div>
        </aside>
      </section>

      <footer><span>Made for ideas that deserve a screen.</span><span>Starter build · No AI provider connected</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
