# Hanbit Studio Plugin SDK

A new instrument or effect is **one JavaScript file**. Call `HB.register({...})` inside it and you’re done.
Load it with Library → **Plugins** → **Import Plugin File** and it appears in the instrument or effect list right away, and stays there after the app restarts.
You can also drop the file onto the tracks area.

- Name files `name.hbplug.js` (plain `.js` works too).
- One file can call `HB.register` several times to ship instruments and effects together.
- Importing a file with the same `id` replaces the old version; settings saved in your projects are kept.
- If you delete a plugin, projects that used it show “Missing Plugin”; import the file again and the settings come back.
- Example: `examples/glass-bell.hbplug.js` (an FM bell instrument). You can also add it with **Install Example** in the Library.

> Inside the Claude preview, the page’s security policy may stop plugin code from running. The Home Screen app (PWA) always runs it.

---

## 1. The smallest instrument

```js
HB.register({
  type: 'instrument',
  id: 'me.simple',                 // a unique id (dotted names recommended)
  name: 'Simple Sine',
  category: 'Synth',
  color: '#ad6cf3',
  params: [
    { id: 'rel', name: 'Release', min: 0.01, max: 4, def: 0.3, curve: 'pow', unit: 's', smart: true },
  ],
  create(host) {
    const ctx = host.ctx, P = host.params, D = host.dsp;
    const vs = D.voices(16);
    return {
      noteOn(n, vel, t) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = D.mtof(n); o.connect(g); g.connect(host.output);
        const env = D.envOn(g.gain, t, { a: 0.005, d: 0.3, s: 0.7, peak: 0.25 * vel });
        o.start(t);
        const v = { note: n, t0: t, rel: false, end: Infinity,
          release(t2, r) { if (v.rel) return; v.rel = true; v.end = D.envOff(g.gain, env, t2, r || P.rel); o.stop(v.end + 0.05); },
          kill() { try { o.stop(); } catch (e) {} g.disconnect(); } };
        vs.add(v, ctx.currentTime);
      },
      noteOff(n, t) { vs.off(n, t); },
      allNotesOff() { vs.all(ctx.currentTime); },
    };
  },
});
```

## 2. The smallest effect

An effect processes the sound arriving at `host.input` and sends it to `host.output`. The studio handles bypass and the dry/wet switch for you.

```js
HB.register({
  type: 'effect', id: 'me.tilt', name: 'Tilt EQ', category: 'EQ & Filter',
  params: [{ id: 'tilt', name: 'Tilt', min: -12, max: 12, def: 0, unit: 'dB' }],
  create(host) {
    const lo = host.ctx.createBiquadFilter(), hi = host.ctx.createBiquadFilter();
    lo.type = 'lowshelf'; lo.frequency.value = 600; hi.type = 'highshelf'; hi.frequency.value = 2500;
    host.input.connect(lo); lo.connect(hi); hi.connect(host.output);
    return {
      setParam(id, v, t) { host.dsp.smooth(lo.gain, -v / 2, t); host.dsp.smooth(hi.gain, v / 2, t); },
      destroy() { host.input.disconnect(); },
    };
  },
});
```

---

## 3. The definition object (`HB.register(def)`)

| Field | Meaning |
|---|---|
| `type` | `'instrument'` or `'effect'` (required) |
| `id` | Unique id (required). Projects store your plugin under this id. |
| `name` | Display name (required) · `short`: short name for narrow spaces |
| `category` | Instruments: `Keyboards` `Synth` `Bass` `Drums` `Sampler` · Effects: `EQ & Filter` `Dynamics` `Space` `Modulation` `Distortion` `Utility` (new names are allowed) |
| `color` | Accent color (`#rrggbb`) |
| `icon` | Icon name: `synth` `wave` `piano` `keys` `drum` `bass` `sampler` `bell` `knob` `fx` `cycle` `headphones` `mic` `gear` `pads` … |
| `description`, `version`, `author` | Shown in the Library |
| `params` | Parameter list (below) |
| `presets` | `[{ name, params: {...}, data }]` — appear in the preset menu. `data`, if present, is passed to `setState(data)`. |
| `noteMap` | For per-note names like drums: `[{ note: 36, name: 'Kick', color: '#ef5b55' }, ...]` → used as row names in the Step Sequencer and Piano Roll |
| `create(host)` | Returns the instance (required; may be `async`) |

### Parameters

```js
{ id: 'cut', name: 'Cutoff', min: 40, max: 18000, def: 1200, curve: 'log', unit: 'Hz', group: 'Filter', smart: true }
```

- `curve`: `'lin'` (default) · `'log'` (frequencies) · `'pow'` (times; finer at the low end)
- `type`: `'num'` (default) · `'int'` · `'bool'` · `'enum'` (passing `options: ['Sine', 'Saw']` makes it an enum automatically)
- `unit`: `Hz` `s` `ms` `dB` `%` (0–1 values) `st` `ct` `pan` `x` — sets how the value is displayed. For your own format: `fmt: v => v.toFixed(1) + ':1'`
- `group`: card name in the generic editor
- `smart: true`: show this control in Smart Controls (up to 8)
- `hidden: true`: hide it from the generic editor

Parameter values are saved automatically with projects and presets. `setParam(id, value, time)` is called on every change, and once per parameter when the instance is created.

---

## 4. `host` — what the studio gives you

| Name | Meaning |
|---|---|
| `host.ctx` | The `AudioContext` |
| `host.sampleRate` | Sample rate |
| `host.output` | Output node to connect to (`GainNode`) |
| `host.input` | (effects only) Input node |
| `host.params` | Current parameter values (`host.params.cut`), always up to date |
| `host.bpm()` | Current tempo |
| `host.on('tempo', fn)` | Called when the tempo changes (for tempo-synced delays and the like) |
| `host.setParam(id, v)` | Change a parameter from inside the plugin (updates the UI and autosave) |
| `host.stateChanged()` | Tell the studio that `getState()` data changed → autosave |
| `host.loadWorklet(name, sourceString, url?)` | Register an AudioWorklet module from a string (runs once). Pass an optional `url` to a file you ship alongside the app as a first choice. |
| `host.decode(arrayBuffer)` | Decode an audio file → `AudioBuffer` |
| `host.pickFile(accept)` | Open a file picker → `File` |
| `host.toast(msg)` | Short notification |
| `host.dsp` | DSP helpers (below) |
| `host.music` | `mtof(n)`, `name(n)` → `'C4'`, `dbToGain(db)`, `gainToDb(g)` |
| `host.ui`, `host.h`, `host.icon`, `host.fit`, `host.gest` | UI tools for custom editors (below) |

### `host.dsp`

- `mtof(note)` — MIDI note → Hz
- `voices(max)` — polyphony manager. Handle voice objects `{note, t0, rel, end, release(t, r), kill(), done?()}` with `add(v, now)`, `off(note, t)` and `all(now)`. Past the limit, the oldest note is released smoothly.
- `envOn(param, t, {a, d, s, peak, base})` → state · `envOff(param, state, t, release)` → end time. Releases never click, whenever they arrive.
- `smooth(param, value, t)` — click-free parameter change
- `shaper(type, amount)` — WaveShaper curve (`soft` `tube` `hard` `fuzz` `fold` `crush` `warm`)
- `ir(ctx, {type, dur, damp})` — reverb impulse (`room` `hall` `plate` `chamber` `cathedral`)
- `noise(ctx)` — noise buffer · `widthNode(ctx)` — stereo width block `{input, output, set(w)}`
- `divNames`, `divSec(index, bpm)` — tempo-synced divisions (`1/4`, `1/8D`, `1/16T` …)

---

## 5. Instance methods (the object `create` returns)

| Method | Instrument | Effect | Meaning |
|---|:-:|:-:|---|
| `noteOn(note, velocity01, time)` | ● | | `time` may be in the future relative to `ctx.currentTime` (playback schedules 0.1 s ahead) |
| `noteOff(note, time)` | ● | | |
| `allNotesOff()` | ● | | On stop and panic |
| `setParam(id, value, time)` | ○ | ○ | |
| `getState()` / `setState(data)` | ○ | ○ | Data to save besides params (samples, patterns, tables …). JSON plus `Float32Array`/`Int16Array`. `setState` may be `async` |
| `editor(container, api)` | ○ | ○ | Custom editor. Without it, a generic editor is built from your params. Return `{destroy()}` |
| `openWindow(container, api)` | ○ | ○ | Large window editor (together with `def.windowEditor: true`) |
| `controls()` | ○ | ○ | Choose the Smart Controls list yourself |
| `noteMap()` | ○ | | When row names change with the state |
| `destroy()` | ○ | ○ | Clean up nodes when the track is deleted or the project closes |

● required · ○ optional

## 6. Custom editors (`editor(el, api)`)

```js
editor(el, api) {
  const cv = api.h('canvas', { style: { width: '100%', height: '160px' } });
  const knobs = api.h('div', { class: 'grow-k' }, api.knob('cut'), api.knob('res', { size: 's' }));
  el.append(cv, knobs);
  const off = api.onParam((id, v) => { /* redraw */ });
  return { destroy() { off(); } };
}
```

- `api.knob(paramId, {size: 's'|'m'|'l', label, color})` — a studio-style knob (double-tap resets to default)
- `api.setParam(id, v)`, `api.getParam(id)`, `api.params`, `api.onParam(fn)` → returns an unsubscribe function
- `api.audition(note, vel, seconds)` — preview a note
- `api.ui.seg(options, value, onChange)`, `api.ui.select(...)`, `api.ui.toggle(label, get, set)`, `api.ui.btn(label, onClick, 'pri'|'sm'|'ghost', icon)`, `api.ui.toast`, `api.ui.prompt({title, value})`
- `api.fit(canvas)` → `[ctx2d, width, height]` (Retina-aware) · `api.gest(el, {down, move, up, tap, dbl, long, pinch, wheel})` — one gesture API for touch, pencil and mouse
- Classes: `grow-k` (row of knobs), `gcard` (card), `note` (help text), `btn`, `seg`

## 7. Using an AudioWorklet

```js
const SRC = `class P extends AudioWorkletProcessor { process(i, o) { /* ... */ return true; } }
registerProcessor('me-proc', P);`;
async create(host) {
  await host.loadWorklet('me-proc', SRC);
  const node = new AudioWorkletNode(host.ctx, 'me-proc', { outputChannelCount: [2] });
  node.connect(host.output);
  return { noteOn(n, v, t) { node.port.postMessage({ on: n, v, at: t }); }, ... };
}
```

To honor the scheduled `time` exactly, send the time in the message and compare it with `currentTime` inside the processor.

## 8. Tips

- Notes are scheduled up to 0.12 s ahead. Always start at the `time` you receive, not at `ctx.currentTime`.
- Build large buffers (samples, impulse responses) once in `create` and reuse them.
- Send everything only to `host.output` (or nodes connected to it). Connecting straight to `ctx.destination` bypasses the mixer and exports.
- If your plugin throws, the studio shows a notification and that slot passes audio through untouched. Other tracks are not affected.
