// Synthesised cat noises, so the app needs no audio files.
export function makeSound(getSettings) {
  let ctx = null, idle = null;
  // Close the audio stream again shortly after each sound: an open, silent stream keeps the
  // computer's audio driver busy the whole time the cat is running.
  function rest(seconds) {
    clearTimeout(idle);
    idle = setTimeout(() => { if (ctx && ctx.state === 'running') ctx.suspend(); }, (seconds + 0.5) * 1000);
  }
  function ac() {
    try {
      if (!ctx) ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  }
  const on = () => getSettings().sound;
  const vol = () => getSettings().volume;
  const rand = (a, b) => a + Math.random() * (b - a);

  function voice(t, f0, f1, f2, len, gain) {
    const c = ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + len * 0.3);
    o.frequency.linearRampToValueAtTime(f2, t + len);
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(1200, t);
    f.frequency.linearRampToValueAtTime(2100, t + len * 0.3);
    f.frequency.linearRampToValueAtTime(900, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
    o.connect(f).connect(g).connect(c.destination);
    o.start(t); o.stop(t + len + 0.1);
  }

  return {
    meow(times = 1) {
      if (!on() || !ac()) return;
      for (let i = 0; i < times; i++) {
        const p = rand(0.9, 1.15);
        voice(ctx.currentTime + i * 0.7, 520 * p, 820 * p, 600 * p, 0.5, vol() * 0.35);
      }
      rest(times * 0.7);
    },
    chirp() {
      if (!on() || !ac()) return;
      voice(ctx.currentTime, 480, 880, 760, 0.18, vol() * 0.25);
      rest(0.3);
    },
    scratch() {
      if (!on() || !ac()) return;
      // a few bursts of filtered noise: claws on sisal
      const len = 0.09, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      for (let n = 0; n < 3; n++) {
        const t = ctx.currentTime + n * 0.14, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = buf; f.type = 'bandpass'; f.frequency.value = rand(2500, 4000); f.Q.value = 1.2;
        g.gain.value = vol() * 0.18;
        src.connect(f).connect(g).connect(ctx.destination);
        src.start(t);
      }
      rest(0.5);
    },
    purr() {
      if (!on() || !ac()) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(),
            am = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 55;
      lfo.frequency.value = 24; lg.gain.value = 0.5; am.gain.value = 0.5;
      f.type = 'lowpass'; f.frequency.value = 320;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol() * 0.2, t + 0.15);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.4);
      lfo.connect(lg).connect(am.gain);
      o.connect(f).connect(am).connect(g).connect(ctx.destination);
      o.start(t); lfo.start(t); o.stop(t + 1.45); lfo.stop(t + 1.45);
      rest(1.5);
    },
  };
}
