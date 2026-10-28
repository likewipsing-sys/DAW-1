/*  Hanbit Studio example plugin — Glass Bell (FM bell)
    Load this file with Library → Plugins → Import Plugin File and it appears
    in the Synth category of the instrument list. Settings saved in your projects come back the next time you open them.
    One file can call HB.register() several times to ship instruments and effects together. */
HB.register({
  type: 'instrument',
  id: 'example.glassbell',
  name: 'Glass Bell (FM)',
  short: 'Glass Bell',
  version: '1.0.0',
  author: 'Hanbit Studio example',
  category: 'Synth',
  color: '#7fd6ff',
  icon: 'bell',
  description: '2-operator FM bell · shimmering keys',
  params: [
    { id: 'ratio', name: 'Ratio', options: ['1:1', '1:2', '1:3.5', '1:1.41', '1:7'], def: 2, smart: true, group: 'FM' },
    { id: 'index', name: 'FM Amount', min: 0, max: 12, def: 4, smart: true, group: 'FM' },
    { id: 'idec', name: 'FM Decay', min: 0.05, max: 6, def: 1.2, curve: 'pow', unit: 's', smart: true, group: 'FM' },
    { id: 'detune', name: 'Detune', min: 0, max: 30, def: 7, unit: 'ct', group: 'FM' },
    { id: 'a', name: 'Attack', min: 0.001, max: 2, def: 0.002, curve: 'pow', unit: 's', group: 'Amp' },
    { id: 'decay', name: 'Decay', min: 0.2, max: 12, def: 3.5, curve: 'pow', unit: 's', smart: true, group: 'Amp' },
    { id: 'r', name: 'Release', min: 0.02, max: 8, def: 1.2, curve: 'pow', unit: 's', smart: true, group: 'Amp' },
    { id: 'tone', name: 'Tone', min: 500, max: 20000, def: 12000, curve: 'log', unit: 'Hz', smart: true, group: 'Amp' },
    { id: 'level', name: 'Level', min: -24, max: 6, def: -4, unit: 'dB', smart: true, group: 'Amp' },
  ],
  presets: [
    { name: 'Glass Bell', params: {} },
    { name: 'Music Box', params: { ratio: 4, index: 2.5, idec: 0.4, decay: 1.6, r: 0.6, tone: 15000 } },
    { name: 'Tubular Bell', params: { ratio: 3, index: 6, idec: 2.5, decay: 7, r: 3, tone: 9000 } },
    { name: 'Soft Rhodes', params: { ratio: 0, index: 1.6, idec: 0.9, decay: 2.5, r: 0.5, tone: 5000, detune: 3 } },
  ],
  create(host) {
    const ctx = host.ctx, P = host.params, D = host.dsp;
    const RATIOS = [1, 2, 3.5, 1.41, 7];
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.5;
    const level = ctx.createGain();
    tone.connect(level); level.connect(host.output);
    const voices = D.voices(24);

    return {
      noteOn(note, vel, t) {
        const f = D.mtof(note), ratio = RATIOS[P.ratio | 0];
        const amp = ctx.createGain(); amp.gain.value = 0;
        const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-0.6, Math.min(0.6, (note - 64) / 40));
        amp.connect(pan); pan.connect(tone);
        // modulator → carrier frequency (classic FM)
        const mod = ctx.createOscillator(), modAmt = ctx.createGain();
        mod.frequency.value = f * ratio;
        const depth = f * ratio * P.index * (0.4 + 0.6 * vel);
        modAmt.gain.setValueAtTime(depth, t);
        modAmt.gain.setTargetAtTime(depth * 0.04, t + 0.002, P.idec / 3);
        mod.connect(modAmt);
        const cars = [-1, 1].map(s => {
          const c = ctx.createOscillator(); c.frequency.value = f; c.detune.value = s * P.detune;
          modAmt.connect(c.frequency); c.connect(amp); return c;
        });
        const env = D.envOn(amp.gain, t, { a: P.a, d: P.decay, s: 0, peak: 0.22 * (0.3 + 0.7 * vel) });
        [mod, ...cars].forEach(o => o.start(t));
        const v = {
          note, t0: t, rel: false, end: t + P.a + P.decay * 1.6 + 0.1,
          release(t2, r) {
            if (v.rel) return; v.rel = true;
            const e = D.envOff(amp.gain, env, Math.max(t2, t + 0.003), r || P.r);
            v.end = Math.min(v.end, e);
            [mod, ...cars].forEach(o => { try { o.stop(v.end + 0.05); } catch (x) {} });
          },
          kill() { [mod, ...cars].forEach(o => { try { o.stop(); } catch (x) {} }); try { pan.disconnect(); } catch (x) {} },
          done() { try { pan.disconnect(); } catch (x) {} },
        };
        [mod, ...cars].forEach(o => { try { o.stop(v.end + 0.05); } catch (x) {} });
        voices.add(v, ctx.currentTime);
      },
      noteOff(note, t) { voices.off(note, t); },
      allNotesOff() { voices.all(ctx.currentTime); },
      setParam(id, v, t) {
        if (id === 'tone') D.smooth(tone.frequency, v, t);
        else if (id === 'level') D.smooth(level.gain, host.music.dbToGain(v), t);
      },
      destroy() { voices.all(ctx.currentTime); level.disconnect(); },
    };
  },
});
