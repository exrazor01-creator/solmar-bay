// Solmar Bay — all sound is synthesized with WebAudio: no audio files, no network.
// Gunshots, explosions, sirens, engine hum, pickups, jingles and a small synthwave loop.
export function createAudio() {
  const A = {
    ctx: null, master: null, muted: false, sirenNodes: null, engineNodes: null,
    musicStep: 0, musicTimer: 0, musicOn: false,
  };
  function ensure() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.5; A.master.connect(A.ctx.destination);
      return true;
    } catch { return false; }
  }
  function noiseBuf(dur) {
    const buf = A.ctx.createBuffer(1, Math.floor(A.ctx.sampleRate * dur), A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    const s = A.ctx.createBufferSource(); s.buffer = noiseBuf(dur);
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t); s.stop(t + dur + 0.02);
  }
  function siren(on) {
    if (!A.ctx) return;
    if (on && !A.sirenNodes) {
      const o = A.ctx.createOscillator(), g = A.ctx.createGain(), lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 750; g.gain.value = 0.05;
      lfo.type = 'square'; lfo.frequency.value = 0.9; lg.gain.value = 260;
      lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(A.master);
      o.start(); lfo.start(); A.sirenNodes = { o, g, lfo };
    } else if (!on && A.sirenNodes) {
      try { A.sirenNodes.o.stop(); A.sirenNodes.lfo.stop(); } catch { /* already stopped */ }
      A.sirenNodes = null;
    }
  }
  function engine(speed01) {
    if (!A.ctx) return;
    if (!A.engineNodes) {
      const o = A.ctx.createOscillator(), g = A.ctx.createGain(), f = A.ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 60; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(A.master); o.start();
      A.engineNodes = { o, g };
    }
    const n = A.engineNodes;
    n.o.frequency.setTargetAtTime(55 + speed01 * 130, A.ctx.currentTime, 0.08);
    n.g.gain.setTargetAtTime(A.muted ? 0 : 0.045 + speed01 * 0.03, A.ctx.currentTime, 0.1);
  }
  // 16-step synthwave loop: bass notes + hats. Called every frame with dt.
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
  function music(dt) {
    if (!A.ctx || A.muted || !A.musicOn) return;
    A.musicTimer += dt;
    const stepDur = 60 / 112 / 2;
    while (A.musicTimer >= stepDur) {
      A.musicTimer -= stepDur;
      const s = A.musicStep % 16;
      const f = BASS[s];
      if (f) blip(f, 0.22, 'triangle', 0.16);
      if (s % 2 === 0) noise(0.03, 0.05, 6000);
      if (s === 0 || s === 8) blip(220, 0.4, 'sine', 0.1, 110);
      A.musicStep += 1;
    }
  }
  return {
    ensure, music,
    shoot() { noise(0.09, 0.5, 2600); blip(160, 0.07, 'square', 0.22, 60); },
    punch() { noise(0.06, 0.3, 900); },
    explosion() { noise(0.7, 0.9, 500); blip(90, 0.5, 'sine', 0.5, 30); },
    pickup() { blip(660, 0.09, 'sine', 0.25); blip(990, 0.12, 'sine', 0.25); },
    cash() { blip(880, 0.08, 'sine', 0.22); setTimeout(() => blip(1320, 0.14, 'sine', 0.22), 90); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.25), i * 110)); },
    fail() { blip(220, 0.4, 'sawtooth', 0.2, 110); },
    siren, engine,
    setMuted(m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 0.5; if (m) siren(false); },
    startMusic() { A.musicOn = true; },
    stopMusic() { A.musicOn = false; },
  };
}
