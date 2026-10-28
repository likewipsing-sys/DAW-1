(function () {
    class C extends AudioWorkletProcessor {
      static get parameterDescriptors() { return [{ name: 'bits', defaultValue: 8, minValue: 1, maxValue: 16 }, { name: 'down', defaultValue: 4, minValue: 1, maxValue: 64 }, { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1 }]; }
      constructor() { super(); this.h = [0, 0]; this.c = 0; }
      process(inp, out, p) {
        const i = inp[0], o = out[0]; if (!i || !i.length) return true;
        const bits = p.bits[0], down = p.down[0], mix = p.mix[0], q = Math.pow(2, bits - 1);
        for (let ch = 0; ch < o.length; ch++) {
          const x = i[ch] || i[0], y = o[ch]; let c = this.c, hv = this.h[ch] || 0;
          for (let s = 0; s < y.length; s++) { c += 1; if (c >= down) { c -= down; hv = Math.round(x[s] * q) / q; } y[s] = x[s] * (1 - mix) + hv * mix; }
          this.h[ch] = hv; if (ch === o.length - 1) this.c = c;
        }
        return true;
      }
    }
    registerProcessor('hb-crusher', C);
  })();