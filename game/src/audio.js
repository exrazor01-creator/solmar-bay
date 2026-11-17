export function createAudio() {
  const A = {
    ctx: null, master: null, muted: false, sirenNodes: null, engineNodes: null,
    rotorNodes: null, boatNodes: null, radio: 0, volume: 0.5,
    musicStep: 0, musicTimer: 0, musicOn: false,
  };
  function ensure() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : A.volume; A.master.connect(A.ctx.destination);
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
  function rotor(on) {
    if (!A.ctx) return;
    if (on && !A.rotorNodes) {
      const o = A.ctx.createOscillator(), g = A.ctx.createGain(), lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 42; g.gain.value = 0.05;
      lfo.type = 'sine'; lfo.frequency.value = 11; lg.gain.value = 0.03;
      lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(A.master);
      o.start(); lfo.start(); A.rotorNodes = { o, lfo };
    } else if (!on && A.rotorNodes) {
      try { A.rotorNodes.o.stop(); A.rotorNodes.lfo.stop(); } catch { /* already stopped */ }
      A.rotorNodes = null;
    }
  }
  function boat(speed01) {
    if (!A.ctx) return;
    if (!A.boatNodes) {
      const o = A.ctx.createOscillator(), g = A.ctx.createGain(), f = A.ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = 48; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(A.master); o.start();
      A.boatNodes = { o, g };
    }
    const n = A.boatNodes;
    n.o.frequency.setTargetAtTime(46 + speed01 * 60, A.ctx.currentTime, 0.1);
    n.g.gain.setTargetAtTime(speed01 <= 0 ? 0 : (A.muted ? 0 : 0.03 + speed01 * 0.025), A.ctx.currentTime, 0.1);
  }
  const RADIO = [
    { bass: [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0], bpm: 112, wave: 'triangle' },
    { bass: [82.4, 82.4, 0, 98, 0, 82.4, 0, 110, 98, 0, 82.4, 0, 73.4, 0, 98, 0], bpm: 140, wave: 'sawtooth' },
    { bass: [65.4, 0, 0, 82.4, 0, 0, 98, 0, 0, 87.3, 0, 0, 110, 0, 98, 0], bpm: 84, wave: 'sine' },
  ];
  const RADIO_NAMES = ['Pulse FM', 'Bay Rock', 'Coast Jazz'];
  function music(dt) {
    if (!A.ctx || A.muted || !A.musicOn) return;
    const st = RADIO[A.radio];
    A.musicTimer += dt;
    const stepDur = 60 / st.bpm / 2;
    while (A.musicTimer >= stepDur) {
      A.musicTimer -= stepDur;
      const s = A.musicStep % 16;
      const f = st.bass[s];
      if (f) blip(f, 0.22, st.wave, 0.16);
      if (s % 2 === 0) noise(0.03, 0.05, 6000);
      if (s === 0 || s === 8) blip(220, 0.4, 'sine', 0.1, 110);
      A.musicStep += 1;
    }
  }
  return {
    ensure, music,
    shoot() { noise(0.09, 0.5, 2600); blip(160, 0.07, 'square', 0.22, 60); },
    shotgun() { noise(0.22, 0.8, 900); blip(90, 0.25, 'sine', 0.5, 40); },
    rifle() { noise(0.07, 0.4, 3200); blip(190, 0.06, 'square', 0.18, 70); },
    sniper() { noise(0.3, 0.9, 700); blip(70, 0.4, 'sine', 0.5, 30); },
    step() { noise(0.05, 0.12, 500); },
    thunder() { noise(1.4, 0.7, 220); blip(55, 1.2, 'sine', 0.4, 28); },
    splash() { noise(0.35, 0.3, 3500); },
    collect() { blip(880, 0.08, 'sine', 0.2); setTimeout(() => blip(1174, 0.1, 'sine', 0.2), 70); setTimeout(() => blip(1568, 0.16, 'sine', 0.2), 140); },
    punch() { noise(0.06, 0.3, 900); },
    explosion() { noise(0.7, 0.9, 500); blip(90, 0.5, 'sine', 0.5, 30); },
    pickup() { blip(660, 0.09, 'sine', 0.25); blip(990, 0.12, 'sine', 0.25); },
    cash() { blip(880, 0.08, 'sine', 0.22); setTimeout(() => blip(1320, 0.14, 'sine', 0.22), 90); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.25), i * 110)); },
    fail() { blip(220, 0.4, 'sawtooth', 0.2, 110); },
    siren, engine, rotor, boat,
    setMuted(m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : A.volume; if (m) { siren(false); rotor(false); } },
    setVolume(v) { A.volume = Math.max(0, Math.min(1, v)); if (A.master) A.master.gain.value = A.muted ? 0 : A.volume; },
    getVolume() { return A.volume; },
    cycleRadio() { A.radio = (A.radio + 1) % 3; return RADIO_NAMES[A.radio]; },
    setRadio(i) { A.radio = i % 3; },
    radioName() { return RADIO_NAMES[A.radio]; },
    startMusic() { A.musicOn = true; },
    stopMusic() { A.musicOn = false; },
  };
}
