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

  // one bird chirp: a quick sine sweep with a little warble
  function tweetAt(t, f0, f1, len, gain) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len);
    lfo.frequency.value = 60; lg.gain.value = f0 * 0.04;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(ctx.destination);
    o.start(t); lfo.start(t); o.stop(t + len + 0.02); lfo.stop(t + len + 0.02);
  }

  return {
    // `pitch` tells the birds apart
    tweet(pitch = 1) {
      if (!on() || !ac()) return;
      const t = ctx.currentTime, p = rand(0.9, 1.15) * pitch;
      tweetAt(t, 3200 * p, 4300 * p, 0.07, vol() * 0.12);
      tweetAt(t + 0.1, 3600 * p, 2900 * p, 0.08, vol() * 0.12);
      rest(0.3);
    },
    song(pitch = 1) {
      if (!on() || !ac()) return;
      let t = ctx.currentTime;
      const n = 5 + Math.floor(rand(0, 5));
      for (let i = 0; i < n; i++) {
        const f = rand(2600, 4600) * pitch, len = rand(0.05, 0.12);
        tweetAt(t, f, f * rand(0.8, 1.3), len, vol() * 0.1);
        t += len + rand(0.03, 0.12);
      }
      rest(t - ctx.currentTime);
    },
    alarm(pitch = 1) {
      if (!on() || !ac()) return;
      for (let i = 0; i < 4; i++) tweetAt(ctx.currentTime + i * 0.09, 4800 * pitch, 4200 * pitch, 0.05, vol() * 0.13);
      rest(0.45);
    },
    meow(times = 1, pitch = 1) {
      if (!on() || !ac()) return;
      for (let i = 0; i < times; i++) {
        const p = rand(0.9, 1.15) * pitch;
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
    // a dog: a short bark (higher and yappier for small dogs)
    bark(times = 1, pitch = 1) {
      if (!on() || !ac()) return;
      const len = 0.12 / Math.sqrt(pitch);
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate), nd = buf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
      for (let i = 0; i < times; i++) {
        const t = ctx.currentTime + i * 0.28, p = rand(0.92, 1.08) * pitch;
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(330 * p, t);
        o.frequency.exponentialRampToValueAtTime(520 * p, t + len * 0.25);
        o.frequency.exponentialRampToValueAtTime(240 * p, t + len);
        f.type = 'bandpass'; f.frequency.value = 1100 * Math.sqrt(p); f.Q.value = 1.6;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol() * 0.4, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(f).connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + len + 0.02);
        const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
        n.buffer = buf; nf.type = 'bandpass'; nf.frequency.value = 1600 * Math.sqrt(p); nf.Q.value = 0.8;
        ng.gain.value = vol() * 0.18;
        n.connect(nf).connect(ng).connect(ctx.destination);
        n.start(t);
      }
      rest(times * 0.28 + 0.2);
    },
    // the pig: one or two short nasal grunts
    oink(times = 2) {
      if (!on() || !ac()) return;
      for (let i = 0; i < times; i++) {
        const t = ctx.currentTime + i * 0.22, p = rand(0.9, 1.2), len = 0.14;
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(),
              f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(190 * p, t);
        o.frequency.linearRampToValueAtTime(260 * p, t + len * 0.4);
        o.frequency.linearRampToValueAtTime(170 * p, t + len);
        lfo.frequency.value = 38; lg.gain.value = 40;
        lfo.connect(lg).connect(o.frequency);
        f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2.5;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol() * 0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(f).connect(g).connect(ctx.destination);
        o.start(t); lfo.start(t); o.stop(t + len + 0.02); lfo.stop(t + len + 0.02);
      }
      rest(times * 0.22 + 0.2);
    },
    // the little dragon: a warbly chirp that drops into a low rumble
    grumble(times = 1, pitch = 1) {
      if (!on() || !ac()) return;
      for (let i = 0; i < times; i++) {
        const t = ctx.currentTime + i * 0.5, p = rand(0.9, 1.1) * pitch, len = 0.42;
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(),
              f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(380 * p, t);
        o.frequency.exponentialRampToValueAtTime(620 * p, t + 0.08);
        o.frequency.exponentialRampToValueAtTime(150 * p, t + len);
        lfo.frequency.value = 26; lg.gain.value = 30 * p;
        lfo.connect(lg).connect(o.frequency);
        f.type = 'bandpass'; f.frequency.value = 850; f.Q.value = 1.8;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol() * 0.32, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(f).connect(g).connect(ctx.destination);
        o.start(t); lfo.start(t); o.stop(t + len + 0.02); lfo.stop(t + len + 0.02);
      }
      rest(times * 0.5 + 0.2);
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
