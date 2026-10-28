(function proc() {
    const TAU = Math.PI * 2;
    class BQ {
      constructor() { this.z1 = this.z2 = 0; this.b0 = 1; this.b1 = this.b2 = this.a1 = this.a2 = 0; }
      set(type, f, q, g) {
        const A = Math.pow(10, g / 40), w = TAU * Math.min(f, sampleRate * 0.45) / sampleRate, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q); let b0, b1, b2, a0, a1, a2;
        if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
        else if (type === 'pk') { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
        else if (type === 'ls') { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * cs + s); b1 = 2 * A * ((A - 1) - (A + 1) * cs); b2 = A * ((A + 1) - (A - 1) * cs - s); a0 = (A + 1) + (A - 1) * cs + s; a1 = -2 * ((A - 1) + (A + 1) * cs); a2 = (A + 1) + (A - 1) * cs - s; }
        else { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cs + s); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s); a0 = (A + 1) - (A - 1) * cs + s; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s; }
        this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
      }
      p(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
    }
    const STY = [ // lp(excite), pluck pos, bright loop, T60 mult, attack noise, thump
      { c: 0.62, pp: 0.22, b: 0.32, t: 1.0, nz: 0.05, th: 0.25 },  // finger
      { c: 0.18, pp: 0.12, b: 0.18, t: 0.9, nz: 0.25, th: 0.05 },  // pick
      { c: 0.05, pp: 0.33, b: 0.1, t: 0.8, nz: 0.4, th: 0.6 },     // slap
      { c: 0.72, pp: 0.2, b: 0.55, t: 0.22, nz: 0.08, th: 0.3 },   // muted
      { c: 0.78, pp: 0.25, b: 0.42, t: 1.25, nz: 0, th: 0.1 },     // fretless
    ];
    class Voice {
      constructor() { this.buf = new Float32Array(4096); this.hist = new Float32Array(4096); this.w = 0; this.on = false; this.rel = false; this.lp = 0; this.g = 0.999; this.gT = 0.999; this.f = 55; this.fT = 55; this.n = -1; this.age = 0; this.tr = 0; this.trD = 0; this.thPh = 0; this.thA = 0; this.vib = 0; this.dc = 0; this.dcx = 0; this.e = 0; }
    }
    class Bass extends AudioWorkletProcessor {
      constructor() {
        super();
        this.p = { style: 0, tone: 0.55, sustain: 0.6, pickup: 0.3, mute: 0, drive: 0.25, amp: 1, low: 2, mid: 0, high: 0, glide: 0.04, mono: 1, level: 0.8, comp: 0.4, noise: 0.35 };
        this.V = []; for (let i = 0; i < 5; i++) this.V.push(new Voice());
        this.q = []; this.held = []; this.seed = 1234567;
        this.eqL = new BQ(); this.eqM = new BQ(); this.eqH = new BQ(); this.cab = new BQ(); this.cab2 = new BQ(); this.env = 0; this.gc = 1; this.dcx = 0; this.dcy = 0;
        this.updEq();
        this.port.onmessage = e => {
          const d = e.data;
          if (d.t === 'p') { this.p[d.id] = d.v; if (['low', 'mid', 'high', 'amp'].includes(d.id)) this.updEq(); }
          else if (d.t === 'on' || d.t === 'off') this.q.push(d);
          else if (d.t === 'flush') { this.q.length = 0; this.held.length = 0; for (const v of this.V) { v.rel = true; v.gT = 0.9; } }
        };
      }
      updEq() { const p = this.p; this.eqL.set('ls', 90, 0.7, p.low); this.eqM.set('pk', 650, 0.9, p.mid); this.eqH.set('hs', 2800, 0.7, p.high); const cab = [9500, 5200, 3800][p.amp | 0] || 5200; this.cab.set('lp', cab, 0.75, 0); this.cab2.set('lp', cab * 1.4, 0.6, 0); }
      rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 2147483648 - 1; }
      excite(v, vel, retrig) {
        const p = this.p, st = STY[p.style | 0] || STY[0], N = sampleRate / v.f, L = Math.max(2, Math.round(N));
        const bright = Math.min(0.95, st.c * (1.15 - p.tone * 0.6) * (1.25 - vel * 0.5));
        const tmp = new Float32Array(L); let a = 0, b = 0;
        for (let k = 0; k < L; k++) { const x = this.rnd(); a += (x - a) * (1 - bright); b += (a - b) * (1 - bright * 0.8); tmp[k] = b; }
        const P = Math.max(1, Math.round(st.pp * L)); let m = 0;
        const ex = new Float32Array(L); for (let k = 0; k < L; k++) { ex[k] = tmp[k] - (k >= P ? tmp[k - P] : 0); m = Math.max(m, Math.abs(ex[k])); }
        const amp = vel * 0.9 / (m || 1);
        const keep = retrig ? 0.25 : 0;
        for (let k = 0; k < L; k++) { const i = (v.w - L + k + 8192) & 4095; v.buf[i] = v.buf[i] * keep + ex[k] * amp; }
        v.lp = 0; v.tr = st.nz * p.noise * vel; v.trD = 0; v.thA = st.th * vel; v.thPh = 0; v.age = 0;
      }
      start(n, vel) {
        const p = this.p, f = 440 * Math.pow(2, (n - 69) / 12);
        let v;
        if (p.mono > 0.5) {
          v = this.V[0];
          const legato = v.on && !v.rel && this.held.length > 0 && p.glide > 0.001;
          this.held.push(n); v.n = n; v.fT = f;
          if (legato && (p.style | 0) !== 2) { v.rel = false; return; }
          if (!v.on || p.glide <= 0.001) v.f = f;
          v.on = true; v.rel = false; this.excite(v, vel, true);
        } else {
          v = this.V.find(x => !x.on) || this.V.reduce((a, b) => (a.age > b.age ? a : b));
          const re = v.on; v.on = true; v.rel = false; v.n = n; v.f = v.fT = f; this.excite(v, vel, re);
        }
        this.setDecay(v);
      }
      setDecay(v) {
        const p = this.p, st = STY[p.style | 0] || STY[0];
        const t60 = (0.6 + p.sustain * 7) * st.t * (1 - p.mute * 0.85) * Math.min(1.4, Math.max(0.5, 80 / v.f + 0.4));
        v.gT = Math.pow(10, -3 / (v.f * t60)); if (!v.rel) v.g = v.gT;
      }
      stop(n) {
        const p = this.p;
        if (p.mono > 0.5) {
          const i = this.held.lastIndexOf(n); if (i >= 0) this.held.splice(i, 1);
          const v = this.V[0];
          if (v.n === n) {
            if (this.held.length) { const t = this.held[this.held.length - 1]; v.n = t; v.fT = 440 * Math.pow(2, (t - 69) / 12); if (p.glide <= 0.001) v.f = v.fT; this.setDecay(v); }
            else { v.rel = true; v.gT = Math.pow(10, -3 / (v.f * (0.05 + (1 - p.mute) * 0.07))); }
          }
          return;
        }
        for (const v of this.V) if (v.on && !v.rel && v.n === n) { v.rel = true; v.gT = Math.pow(10, -3 / (v.f * (0.05 + (1 - p.mute) * 0.07))); }
      }
      process(inp, out) {
        const o = out[0], L = o[0], R = o[1] || o[0], n = L.length, sr = sampleRate, p = this.p, st = STY[p.style | 0] || STY[0];
        // events (sample accurate)
        this.q.sort((a, b) => (a.at || 0) - (b.at || 0));
        const evs = []; for (let i = 0; i < this.q.length; i++) { const e = this.q[i], off = Math.round(((e.at || 0) - currentTime) * sr); if (off < n) { evs.push([Math.max(0, off), e]); this.q.splice(i, 1); i--; } }
        let ei = 0;
        const loopB = Math.max(0, Math.min(0.85, st.b + (1 - p.tone) * 0.35 + p.mute * 0.25));
        const comp = loopB / (1 - loopB), glideC = p.glide > 0.001 ? 1 - Math.exp(-1 / (sr * p.glide * 0.35)) : 1;
        const drive = 1 + p.drive * 9, ampT = p.amp | 0, level = p.level * 0.7, th = 0.5 - p.comp * 0.42, ratio = 1 + p.comp * 5;
        for (let s = 0; s < n; s++) {
          while (ei < evs.length && evs[ei][0] <= s) { const e = evs[ei++][1]; if (e.t === 'on') this.start(e.n, e.v == null ? 0.8 : e.v); else this.stop(e.n); }
          let sum = 0;
          for (const v of this.V) {
            if (!v.on) continue;
            v.f += (v.fT - v.f) * glideC; v.g += (v.gT - v.g) * 0.004;
            let N = sr / v.f - comp; if ((p.style | 0) === 4) N *= 1 + 0.0025 * Math.sin(v.vib += TAU * 5.2 / sr) * Math.min(1, v.age / (sr * 0.4));
            N = Math.min(4000, Math.max(2, N));
            const rp = v.w - N, i0 = Math.floor(rp), fr = rp - i0, a = v.buf[(i0 + 8192) & 4095], b = v.buf[(i0 + 8193) & 4095];
            const y = a + (b - a) * fr;
            v.lp = (1 - loopB) * y + loopB * v.lp;
            v.buf[v.w] = v.lp * v.g;
            const P = Math.max(1, Math.round(N * (0.08 + p.pickup * 0.32)));
            const pk = y - v.hist[(v.w - P + 4096) & 4095] * 0.9; v.hist[v.w] = y;
            v.w = (v.w + 1) & 4095; v.age++;
            let x = pk;
            if (v.tr > 0.0005) { x += this.rnd() * v.tr; v.tr *= 0.9935; }
            if (v.thA > 0.0005) { v.thPh += TAU * v.f * 0.5 / sr; x += Math.sin(v.thPh) * v.thA; v.thA *= 0.9982; }
            v.e = Math.max(Math.abs(x), v.e * 0.9995);
            if (v.rel && v.e < 0.0004 || v.age > sr * 30) { v.on = false; v.buf.fill(0); v.hist.fill(0); v.e = 0; }
            sum += x;
          }
          // amp
          let x = sum * drive;
          x = ampT === 0 ? x / (1 + Math.abs(x) * 0.25) : ampT === 1 ? Math.tanh(x + 0.1 * x * x) : Math.max(-1, Math.min(1, x * 1.3)) * 0.85 + Math.tanh(x) * 0.15;
          x /= Math.sqrt(drive);
          x = this.eqH.p(this.eqM.p(this.eqL.p(x)));
          x = this.cab2.p(this.cab.p(x));
          const ax = Math.abs(x); this.env += (ax - this.env) * (ax > this.env ? 0.01 : 0.0004);
          const tg = this.env > th ? Math.pow(th / this.env, 1 - 1 / ratio) : 1; this.gc += (tg - this.gc) * 0.01;
          x *= this.gc * (1 + p.comp * 0.9);
          const yv = x - this.dcx + 0.995 * this.dcy; this.dcx = x; this.dcy = yv;
          L[s] = R[s] = yv * level;
        }
        return true;
      }
    }
    registerProcessor('hb-bass', Bass);
  })();