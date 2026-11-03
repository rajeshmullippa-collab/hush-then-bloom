/* Hush, Then Bloom — a small wordless game for thatgamejam #02.
   Made by Rajesh Mullippa with Hark (an AI agent). All visuals and sounds are
   generated procedurally by this code; the finale plays the jam's theme track
   (composed by Jason Grace) unmodified. */
(() => {
'use strict';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const themeAudio = document.getElementById('theme');
const fog = document.createElement('canvas');
const fctx = fog.getContext('2d');

// ---------- utils ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261107);
const rr = (a, b) => a + R() * (b - a);
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------- screen ----------
let W = 0, H = 0, DPR = 1, scale = 1, viewH = 720, viewHTarget = 720;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  fog.width = Math.max(2, Math.round(cv.width / 2)); fog.height = Math.max(2, Math.round(cv.height / 2));
}
addEventListener('resize', resize); resize();

// ---------- world layout ----------
const WORLD_HALF = 1150, GROUND_Y = 330, VEIL1 = -1500, VEIL2 = -5600, TREE_Y = -6450, TOP_Y = -7600;
const TREE_CENTER = { x: 0, y: TREE_Y - 330 };
const NEED1 = 5, NEED2 = 12;
const HUES = ['#ffd27a', '#ffb38a', '#ff9fb4', '#c9a6ff', '#9fd8ff', '#a6ffd8', '#fff1a8'];

// glow sprite cache
const spriteCache = {};
function glow(color) {
  if (spriteCache[color]) return spriteCache[color];
  const s = document.createElement('canvas'); s.width = s.height = 128;
  const g = s.getContext('2d'); const c = hex(color);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgb(c, 1)); gr.addColorStop(0.18, rgb(c, 0.55)); gr.addColorStop(0.45, rgb(c, 0.16)); gr.addColorStop(1, rgb(c, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return (spriteCache[color] = s);
}
function drawGlow(color, x, y, r, a = 1) {
  if (a <= 0.003 || r <= 0) return;
  ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}

// stars
const stars = []; for (let i = 0; i < 260; i++) stars.push({ x: R(), y: R(), s: rr(0.4, 1.6), p: rr(0, TAU), f: rr(0.5, 2) });

// ground profile
function groundAt(x) { return GROUND_Y - 40 * Math.sin(x * 0.0021 + 1.3) - 22 * Math.sin(x * 0.0057 + 0.4) - 9 * Math.sin(x * 0.017); }
const grass = []; for (let x = -WORLD_HALF - 200; x < WORLD_HALF + 200; x += rr(7, 13)) grass.push({ x, h: rr(18, 58), p: rr(0, TAU), lean: rr(-0.3, 0.3) });
const flowers = []; for (let x = -WORLD_HALF + 60; x < WORLD_HALF - 60; x += rr(70, 150)) flowers.push({ x, y: groundAt(x) - rr(30, 60), open: 0, hue: HUES[(R() * HUES.length) | 0], p: rr(0, TAU) });
// far hills (parallax)
const farHills = [0.35, 0.6].map((f, k) => { const pts = []; for (let x = -2600; x <= 2600; x += 40) pts.push([x, GROUND_Y - 60 - k * -30 - 90 * (1 - f) - 70 * Math.sin(x * 0.0013 * (k + 1) + k * 2) - 30 * Math.sin(x * 0.004 + k)]); return { f, pts }; });

// floating islands (ascent)
function blob(rx, ry, n = 18) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; const lower = Math.sin(a) > 0; const k = lower ? rr(0.9, 1.6) : rr(0.85, 1.05); pts.push([Math.cos(a) * rx * rr(0.85, 1.1), Math.sin(a) * ry * k * (lower ? 1.6 : 0.6)]); } return pts; }
const islands = [];
for (let i = 0; i < 26; i++) { const f = i % 3 === 0 ? 1 : (i % 3 === 1 ? 0.6 : 0.4); islands.push({ x: rr(-1300, 1300), y: rr(VEIL2 - 200, VEIL1 + 300), rx: rr(60, 190) * (f === 1 ? 1 : 1.3), ry: rr(26, 50), f, pts: null, roots: [] }); }
islands.forEach(s => { s.pts = blob(s.rx, s.ry); const n = (s.rx / 30) | 0; for (let i = 0; i < n; i++) s.roots.push({ x: rr(-s.rx * 0.6, s.rx * 0.6), l: rr(20, 90), p: rr(0, TAU) }); });
const treeIsland = { x: 0, y: TREE_Y + 40, rx: 330, ry: 60, f: 1, pts: blob(330, 60, 28), roots: [] };
for (let i = 0; i < 16; i++) treeIsland.roots.push({ x: rr(-220, 220), l: rr(40, 170), p: rr(0, TAU) });

// tree
const segs = [], tips = [];
(function branch(x, y, a, len, w, d) {
  const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
  segs.push({ x1: x, y1: y, x2, y2, w, d });
  if (d >= 7) { tips.push({ x: x2, y: y2, bud: -1, open: 0, p: rr(0, TAU) }); return; }
  const spread = 0.38 + d * 0.035;
  branch(x2, y2, a - spread + rr(-0.12, 0.12), len * rr(0.7, 0.8), w * 0.68, d + 1);
  branch(x2, y2, a + spread + rr(-0.12, 0.12), len * rr(0.7, 0.8), w * 0.68, d + 1);
  if (d === 2 || d === 4) branch(x2, y2, a + rr(-0.15, 0.15), len * 0.62, w * 0.55, d + 2);
})(0, TREE_Y + 10, -Math.PI / 2, 175, 34, 0);

// motes (sleeping lights)
const motes = [];
function addMote(x, y) { motes.push({ x, y, hx: x, hy: y, state: 'sleep', hue: HUES[motes.length % HUES.length], p: rr(0, TAU), wake: 0, tx: 0, ty: 0, bud: -1 }); }
[[-820, 150], [-430, 40], [-90, 210], [310, 70], [700, 190], [960, -40], [-980, -260], [520, -380], [-260, -620], [120, -1000]].slice(0, 6)
  .forEach(([x, y], i) => addMote(x + rr(-40, 40), Math.min(y + rr(-30, 30), groundAt(x) - 70)));
// ascent motes
for (let i = 0; i < 10; i++) { const y = lerp(VEIL1 - 250, VEIL2 + 250, (i + 0.5) / 10) + rr(-120, 120); addMote(rr(-950, 950), y); }

// mists & updrafts
const mists = [];
for (let i = 0; i < 9; i++) mists.push({ x0: rr(-900, 900), y: lerp(VEIL1 - 500, VEIL2 + 400, i / 8) + rr(-100, 100), r: rr(80, 130), amp: rr(250, 600), sp: rr(0.12, 0.3), p: rr(0, TAU), x: 0, calm: 0 });
const drafts = [{ x: -650, y0: VEIL1 - 100, y1: -3200, w: 120 }, { x: 600, y0: -2700, y1: -4300, w: 120 }, { x: -200, y0: -3900, y1: VEIL2 + 100, w: 130 }];
const draftParts = []; drafts.forEach(d => { for (let i = 0; i < 40; i++) draftParts.push({ d, x: rr(-d.w / 2, d.w / 2), y: rr(d.y1, d.y0), v: rr(160, 320) }); });

const veils = [{ y: VEIL1, need: NEED1, open: false, fade: 0 }, { y: VEIL2, need: NEED2, open: false, fade: 0 }];

// ---------- state ----------
const player = { x: 0, y: GROUND_Y - 120, vx: 0, vy: 0, invuln: 0, charge: 0, charging: false, cool: 0 };
const trail = []; // recent player positions
const chain = []; // companions in order
const waves = [], parts = [];
const cam = { x: 0, y: player.y, shake: 0 };
let state = 'title', time = 0, stateT = 0, fade = 1, fadeTarget = 0;
let beatT = 0; const BEAT = 1.5;
let finale = null; // { t0, clockMode, cues, bloom }
let endAlpha = 0;
const input = { px: 0, py: 0, pointer: false, lastMove: -10, keys: {}, down: false };

// ---------- audio (procedural) ----------
let AC = null, master = null, pad = null, sfxBus = null, sfxOn = true;
const PENTA = [277.18, 311.13, 349.23, 415.3, 466.16, 554.37, 622.25, 698.46, 830.61, 932.33, 1108.73, 1244.5];
function initAudio() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
  // simple feedback-delay space
  sfxBus = AC.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
  const dl = AC.createDelay(1); dl.delayTime.value = 0.37; const fb = AC.createGain(); fb.gain.value = 0.38; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  const wet = AC.createGain(); wet.gain.value = 0.35; sfxBus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(master);
  // pad
  const pg = AC.createGain(); pg.gain.value = 0; const pf = AC.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 600; pf.Q.value = 0.7;
  pf.connect(pg); pg.connect(master);
  const lfo = AC.createOscillator(); lfo.frequency.value = 0.07; const lg = AC.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(pf.frequency); lfo.start();
  const oscs = [138.59, 207.65, 349.23, 277.18].map((f, i) => { const o = AC.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4; const g = AC.createGain(); g.gain.value = [0.5, 0.32, 0.18, 0.2][i]; o.connect(g); g.connect(pf); o.start(); return o; });
  pad = { g: pg, f: pf, oscs };
  pg.gain.setTargetAtTime(0.11, AC.currentTime, 2.5);
}
const CHORDS = [[138.59, 207.65, 349.23, 277.18], [116.54, 174.61, 277.18, 349.23], [92.5, 138.59, 233.08, 369.99]];
let chordIdx = 0;
function setChord(i) { if (!pad || i === chordIdx) return; chordIdx = i; CHORDS[i].forEach((f, k) => pad.oscs[k].frequency.setTargetAtTime(f, AC.currentTime, 1.6)); }
function chime(freq, vol = 0.18, dur = 2.6, delay = 0) {
  if (!AC || !sfxOn) return; const t = AC.currentTime + delay;
  [1, 2.01, 3.0].forEach((m, i) => { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m; const g = AC.createGain(); const v = vol * [1, 0.25, 0.08][i];
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + i)); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.1); });
}
function whoosh(bright) {
  if (!AC || !sfxOn) return; const t = AC.currentTime; const len = 1.2; const b = AC.createBuffer(1, AC.sampleRate * len, AC.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(bright ? 2600 : 1400, t + 0.5);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(bright ? 0.07 : 0.045, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + len); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t);
}
function thump(v = 0.12) {
  if (!AC || !sfxOn) return; const t = AC.currentTime; const o = AC.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
}
function sigh() {
  if (!AC || !sfxOn) return; const t = AC.currentTime; [0, 7].forEach(dt => { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(233, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.9); o.detune.value = dt * 10; const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1.1); });
}

// ---------- input ----------
function toWorld(sx, sy) { const s = cv.height / viewH; return { x: cam.x + (sx * DPR - cv.width / 2) / s, y: cam.y + (sy * DPR - cv.height / 2) / s }; }
cv.addEventListener('pointermove', e => { input.px = e.clientX; input.py = e.clientY; input.pointer = true; input.lastMove = time; });
cv.addEventListener('pointerdown', e => { input.px = e.clientX; input.py = e.clientY; input.pointer = true; input.lastMove = time; input.down = true; press(); });
addEventListener('pointerup', () => { input.down = false; release(); });
addEventListener('keydown', e => {
  if (e.repeat) return; input.keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); press(); }
  if (e.code === 'KeyF') { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) input.pointer = false;
});
addEventListener('keyup', e => { input.keys[e.code] = false; if (e.code === 'Space' || e.code === 'Enter') release(); });
cv.addEventListener('contextmenu', e => e.preventDefault());

function press() {
  if (state === 'title' && stateT > 0.6) { startGame(); return; }
  if (state === 'end' && stateT > 3) { location.reload(); return; }
  if (state === 'play' || state === 'finale') { player.charging = true; }
}
function release() {
  if (!player.charging) return; player.charging = false;
  if (player.charge > 0.12 && player.cool <= 0) sing(player.charge);
  player.charge = 0;
}
function beatCloseness() { const ph = beatT / BEAT; return Math.min(ph, 1 - ph) * BEAT; } // seconds from nearest beat

function startGame() {
  initAudio();
  // unlock the <audio> element for later playback (within this user gesture)
  try { themeAudio.volume = 0; const p = themeAudio.play(); if (p) p.then(() => { themeAudio.pause(); themeAudio.currentTime = 0; themeAudio.volume = 1; }).catch(() => { themeAudio.volume = 1; }); } catch (e) {}
  state = 'play'; stateT = 0; chime(PENTA[0], 0.15); chime(PENTA[5], 0.1, 3, 0.25);
}

function sing(charge) {
  const harmony = beatCloseness() < 0.2;
  const max = (170 + charge * 170 + chain.length * 9) * (harmony ? 1.6 : 1);
  waves.push({ x: player.x, y: player.y, r: 10, max, harmony, a: 1 });
  player.cool = 0.25;
  if (state === 'finale') { finaleSing(harmony); return; }
  whoosh(harmony);
  const n = chain.length; const base = harmony ? [0, 2, 4, 5] : [0, 2];
  base.forEach((k, i) => chime(PENTA[(k + Math.min(n, 6)) % PENTA.length] * (harmony ? 1 : 0.5), harmony ? 0.09 : 0.07, 2.4, i * 0.07));
  for (let i = 0; i < (harmony ? 40 : 16); i++) { const a = rr(0, TAU), s = rr(80, harmony ? 380 : 200); parts.push({ x: player.x, y: player.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rr(0.6, 1.4), size: rr(4, 10), color: harmony ? '#ffe6a0' : '#bcd6ff', drag: 2.2 }); }
}

// ---------- gameplay ----------
function wakeMote(m) {
  if (m.state !== 'sleep') return;
  m.state = 'follow'; m.wake = 1; chain.push(m);
  const n = chain.length;
  chime(PENTA[(n - 1) % PENTA.length], 0.17); chime(PENTA[(n + 3) % PENTA.length], 0.06, 3, 0.18);
  for (let i = 0; i < 26; i++) { const a = rr(0, TAU), s = rr(40, 220); parts.push({ x: m.x, y: m.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rr(0.7, 1.6), size: rr(4, 9), color: m.hue, drag: 2 }); }
}
function loseCompanions(k) {
  for (let i = 0; i < k && chain.length; i++) {
    const m = chain.pop(); m.state = 'sleep'; const a = rr(0, TAU), d = rr(120, 260);
    m.hx = clamp(player.x + Math.cos(a) * d, -WORLD_HALF + 50, WORLD_HALF - 50); m.hy = player.y + Math.sin(a) * d;
    if (player.y > VEIL1) m.hy = Math.min(m.hy, groundAt(m.hx) - 60);
    m.x += Math.cos(a) * 30; m.y += Math.sin(a) * 30;
  }
}

function update(dt) {
  time += dt; stateT += dt;
  beatT += dt; let beatNow = false; if (beatT >= BEAT) { beatT -= BEAT; beatNow = true; }
  fade = lerp(fade, fadeTarget, 1 - Math.exp(-dt * 1.4));

  // --- player control ---
  const p = player;
  if (state === 'play' || state === 'finale') {
    let dx = 0, dy = 0; const k = input.keys;
    if (k.ArrowLeft || k.KeyA) dx -= 1; if (k.ArrowRight || k.KeyD) dx += 1; if (k.ArrowUp || k.KeyW) dy -= 1; if (k.ArrowDown || k.KeyS) dy += 1;
    let tvx = 0, tvy = 0; const MAX = 400;
    if (dx || dy) { const l = Math.hypot(dx, dy); tvx = dx / l * MAX; tvy = dy / l * MAX; }
    else if (input.pointer) { const w = toWorld(input.px, input.py); const ddx = w.x - p.x, ddy = w.y - p.y; const l = Math.hypot(ddx, ddy); if (l > 6) { const s = Math.min(MAX, l * 2.6); tvx = ddx / l * s; tvy = ddy / l * s; } }
    if (auto.on) { const t = autoTarget(); if (t) { const ddx = t.x - p.x, ddy = t.y - p.y, l = Math.hypot(ddx, ddy); if (l > 6) { const s = Math.min(MAX * 0.9, l * 2.2); tvx = ddx / l * s; tvy = ddy / l * s; } }
      if (beatCloseness() < 0.02 && time - auto.lastSing > 4 && state === 'play') { auto.lastSing = time; sing(0.9); } }
    p.vx = lerp(p.vx, tvx, 1 - Math.exp(-dt * 4)); p.vy = lerp(p.vy, tvy, 1 - Math.exp(-dt * 4));
    // updrafts
    for (const d of drafts) if (Math.abs(p.x - d.x) < d.w / 2 + 20 && p.y < d.y0 && p.y > d.y1) { p.vy -= 900 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    // bounds
    p.x = clamp(p.x, -WORLD_HALF, WORLD_HALF);
    if (p.y > VEIL1) p.y = Math.min(p.y, groundAt(p.x) - 30);
    for (const v of veils) if (!v.open && p.y < v.y + 40 && p.y > v.y - 400) { p.y = v.y + 40; if (p.vy < 0) p.vy *= -0.3; }
    p.y = Math.max(p.y, TOP_Y + 200);
    if (state === 'finale') { const dd = dist(p.x, p.y, TREE_CENTER.x, TREE_CENTER.y); if (dd > 560) { p.x = TREE_CENTER.x + (p.x - TREE_CENTER.x) / dd * 560; p.y = TREE_CENTER.y + (p.y - TREE_CENTER.y) / dd * 560; } }
    if (p.charging) p.charge = Math.min(1, p.charge + dt / 0.8);
    p.cool -= dt; p.invuln -= dt;
  } else if (state === 'title') { p.x = Math.sin(time * 0.4) * 30; p.y = GROUND_Y - 140 + Math.sin(time * 0.9) * 12; }
  trail.unshift({ x: p.x, y: p.y }); if (trail.length > 400) trail.pop();

  // heartbeat sound once you carry lights
  if (beatNow && state === 'play' && chain.length >= 3) thump(0.05 + Math.min(chain.length, 14) * 0.005);

  // --- motes ---
  for (const m of motes) {
    m.p += dt;
    if (m.state === 'sleep') {
      m.x = lerp(m.x, m.hx + Math.sin(m.p * 0.7) * 6, 1 - Math.exp(-dt * 1.5)); m.y = lerp(m.y, m.hy + Math.cos(m.p * 0.9) * 8, 1 - Math.exp(-dt * 1.5));
      if (state === 'play' && dist(m.x, m.y, p.x, p.y) < 70) wakeMote(m);
    } else if (m.state === 'follow') {
      const i = chain.indexOf(m); const tp = trail[Math.min(trail.length - 1, 10 + i * 9)] || p;
      const wob = 14 + i * 0.6; const tx = tp.x + Math.sin(time * 1.7 + i * 1.3) * wob, ty = tp.y + Math.cos(time * 1.3 + i) * wob;
      m.x = lerp(m.x, tx, 1 - Math.exp(-dt * 5)); m.y = lerp(m.y, ty, 1 - Math.exp(-dt * 5));
    } else if (m.state === 'fly') {
      m.ft += dt; const t = smooth(m.ft / m.fdur); m.x = lerp(m.fx, m.tx, t) + Math.sin(t * Math.PI) * m.arc; m.y = lerp(m.fy, m.ty, t) - Math.sin(t * Math.PI) * 60;
      if (m.ft >= m.fdur) { m.state = 'placed'; bloomBud(m.bud, m.perfect); }
    }
    m.wake = Math.max(0, m.wake - dt * 1.2);
  }

  // --- flowers ---
  const lightR = 110 + Math.min(chain.length, 18) * 12;
  for (const f of flowers) { if (dist(f.x, f.y, p.x, p.y) < lightR * 0.6) f.open = Math.min(1, f.open + dt * 1.5); }

  // --- waves ---
  for (const w of waves) {
    w.r += dt * (w.harmony ? 700 : 520); w.a = 1 - w.r / w.max;
    if (state === 'play') {
      for (const m of motes) if (m.state === 'sleep' && Math.abs(dist(m.x, m.y, w.x, w.y) - w.r) < 40) wakeMote(m);
      for (const f of flowers) if (dist(f.x, f.y, w.x, w.y) < w.r) f.open = 1;
      for (const s of mists) if (dist(s.x, s.y, w.x, w.y) < w.r + s.r * 0.5) s.calm = Math.max(s.calm, w.harmony ? 7 : 3);
    }
  }
  for (let i = waves.length - 1; i >= 0; i--) if (waves[i].r >= waves[i].max) waves.splice(i, 1);

  // --- mists ---
  for (const s of mists) {
    s.x = s.x0 + Math.sin(time * s.sp + s.p) * s.amp; s.calm = Math.max(0, s.calm - dt);
    if (state === 'play' && s.calm <= 0 && p.invuln <= 0 && dist(s.x, s.y, p.x, p.y) < s.r * 0.75) {
      p.invuln = 2.2; cam.shake = 10; sigh(); loseCompanions(2);
      const a = Math.atan2(p.y - s.y, p.x - s.x); p.vx += Math.cos(a) * 420; p.vy += Math.sin(a) * 420;
      for (let i = 0; i < 20; i++) { const b = rr(0, TAU); parts.push({ x: p.x, y: p.y, vx: Math.cos(b) * 140, vy: Math.sin(b) * 140, life: 0, max: 1, size: rr(5, 10), color: '#7c6fa8', drag: 2 }); }
    }
  }
  for (const d of draftParts) { d.y -= d.v * dt; if (d.y < d.d.y1) d.y = d.d.y0; }

  // --- veils ---
  for (const v of veils) {
    if (!v.open && chain.length >= v.need && dist(0, v.y, 0, p.y) < 500) {
      v.open = true; [0, 2, 4, 5, 7].forEach((k, i) => chime(PENTA[k], 0.12, 3, i * 0.12));
      for (let i = 0; i < 80; i++) parts.push({ x: p.x + rr(-500, 500), y: v.y + rr(-40, 40), vx: rr(-30, 30), vy: rr(-140, -40), life: 0, max: rr(1.5, 3), size: rr(4, 10), color: HUES[i % HUES.length], drag: 0.5 });
    }
    if (v.open) v.fade = Math.min(1, v.fade + dt * 0.6);
  }
  if (state === 'play') setChord(p.y > VEIL1 ? 0 : p.y > VEIL2 ? 1 : 2);

  // --- finale trigger ---
  if (state === 'play' && dist(p.x, p.y, TREE_CENTER.x, TREE_CENTER.y) < 380) startFinale();
  if (state === 'finale') updateFinale(dt);
  for (const t of tips) t.open = lerp(t.open, t.bud >= 0 && buds[t.bud] && buds[t.bud].open ? 1 : 0, 1 - Math.exp(-dt * 1.2));

  // --- particles ---
  for (const q of parts) { q.life += dt; q.vx *= Math.exp(-dt * q.drag); q.vy *= Math.exp(-dt * q.drag); if (q.g) q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life >= parts[i].max) parts.splice(i, 1);
  if (parts.length > 1400) parts.splice(0, parts.length - 1400);

  // --- camera ---
  viewH = lerp(viewH, viewHTarget, 1 - Math.exp(-dt * 0.8));
  let cx = p.x, cy = p.y - 40;
  if (state === 'finale') { const k = smooth(finale.t / 4); cx = lerp(p.x, TREE_CENTER.x, 0.75 * k); cy = lerp(p.y, TREE_CENTER.y - 20, 0.75 * k); }
  if (state === 'end') { cx = TREE_CENTER.x; cy = TREE_CENTER.y - 60 - Math.min(stateT, 12) * 8; }
  cam.x = lerp(cam.x, cx, 1 - Math.exp(-dt * 2.2)); cam.y = lerp(cam.y, cy, 1 - Math.exp(-dt * 2.2));
  const vw = viewH * cv.width / cv.height; const lim = Math.max(0, WORLD_HALF + 150 - vw / 2); cam.x = clamp(cam.x, -lim, lim);
  if (state !== 'finale' && state !== 'end') cam.y = Math.min(cam.y, GROUND_Y + 120 - viewH / 2);
  cam.shake = Math.max(0, cam.shake - dt * 25);
}

// ---------- autopilot (only used to record the walkthrough video) ----------
const auto = { on: false, lastSing: -10 };
function autoTarget() {
  const p = player;
  if (state === 'finale') return { x: TREE_CENTER.x + Math.cos(time * 0.35) * 260, y: TREE_CENTER.y + 120 + Math.sin(time * 0.5) * 120 };
  const veil = veils.find(v => !v.open && v.y < p.y + 50);
  let best = null, bd = 1e9;
  for (const m of motes) if (m.state === 'sleep' && (!veil || m.y > veil.y) && m.y < p.y + 900) { const d = dist(m.x, m.y, p.x, p.y) + Math.max(0, m.y - p.y) * 0.5; if (d < bd) { bd = d; best = m; } }
  if (best) return best;
  return { x: TREE_CENTER.x, y: veil ? veil.y + 60 : TREE_CENTER.y };
}

// ---------- finale ----------
const STRONG = [20.5, 22.01, 23.01, 24.01, 25.51, 27.0, 27.76, 28.51, 29.26, 30.01, 31.51, 32.26, 33.01, 34.01, 35.51, 38.01, 41.02, 42.02, 47.01, 51.01];
let buds = [];
function startFinale() {
  state = 'finale'; stateT = 0; viewHTarget = 1050;
  const n = chain.length;
  // choose cue times: spread over the strong accents
  const cues = []; for (let i = 0; i < n; i++) cues.push(STRONG[Math.min(STRONG.length - 1, Math.round(i * (STRONG.length - 1) / Math.max(1, n - 1)))] + (i >= STRONG.length ? (i - STRONG.length + 1) * 0.25 : 0));
  if (n === 1) cues[0] = 27.0;
  // choose bud tips spread by angle
  const sorted = tips.map((t, i) => ({ i, a: Math.atan2(t.y - (TREE_Y - 200), t.x) })).sort((a, b) => a.a - b.a);
  buds = [];
  for (let i = 0; i < n; i++) { const t = tips[sorted[Math.floor((i + 0.5) / n * sorted.length)].i]; buds.push({ x: t.x, y: t.y, open: false, perfect: false, cue: cues[i], hue: chain[i].hue, glow: 0 }); }
  tips.forEach(t => { let best = -1, bd = 1e9; buds.forEach((b, j) => { const d = dist(t.x, t.y, b.x, b.y); if (d < bd) { bd = d; best = j; } }); t.bud = best; });
  // the order buds open: interleave left/right for a sweeping feel
  const order = buds.map((b, j) => j).sort((a, b) => Math.abs(buds[a].x) - Math.abs(buds[b].x) || buds[a].y - buds[b].y);
  order.forEach((j, k) => buds[j].cue = cues[k]);
  finale = { t: 0, audio: false, started: false, last: 0, stall: 0 };
  if (pad) { pad.g.gain.cancelScheduledValues(AC.currentTime); pad.g.gain.setTargetAtTime(0, AC.currentTime, 1.2); }
  setTimeout(() => {
    sfxOn = false; // the theme track plays alone, unmodified
    try { themeAudio.currentTime = 0; themeAudio.volume = 1; const pr = themeAudio.play(); if (pr) pr.then(() => { finale.audio = true; }).catch(() => { finale.audio = false; }); } catch (e) {}
    finale.started = true;
  }, 2500);
}
function finaleSing(harmony) {
  const t = finale.t;
  for (const b of buds) if (!b.open && !b.perfect && Math.abs(t - b.cue) < 0.6) { b.perfect = true; break; }
  for (let i = 0; i < (harmony ? 36 : 18); i++) { const a = rr(0, TAU), s = rr(80, 300); parts.push({ x: player.x, y: player.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rr(0.6, 1.4), size: rr(4, 10), color: harmony ? '#ffe6a0' : '#ffd0e0', drag: 2.2 }); }
}
function bloomBud(j, perfect) {
  const b = buds[j]; if (!b) return; b.open = true; b.glow = perfect ? 2 : 1.2;
  const n = perfect ? 70 : 40;
  for (let i = 0; i < n; i++) { const a = rr(0, TAU), s = rr(40, perfect ? 320 : 200); parts.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0, max: rr(1.2, 3), size: rr(4, perfect ? 13 : 10), color: i % 3 ? b.hue : '#fff4d6', drag: 1.4, g: 18 }); }
  cam.shake = perfect ? 4 : 2;
}
function updateFinale(dt) {
  // time follows the audio when it plays, otherwise a steady clock
  if (finale.started) {
    if (finale.audio && !themeAudio.paused) { const at = themeAudio.currentTime; finale.t = Math.max(finale.t, at); }
    else finale.t += dt;
  }
  const t = finale.t;
  for (let j = 0; j < buds.length; j++) {
    const b = buds[j], m = chain[j]; b.glow = Math.max(0, b.glow - dt * 0.6);
    if (m && m.state === 'follow' && t >= b.cue - 1.1 && finale.started) { m.state = 'fly'; m.bud = j; m.fx = m.x; m.fy = m.y; m.tx = b.x; m.ty = b.y; m.ft = 0; m.fdur = Math.max(0.3, b.cue - t); m.arc = rr(-120, 120); m.perfect = false; }
    if (m && m.state === 'fly') m.perfect = b.perfect;
  }
  // ambient petals from open buds
  for (const b of buds) if (b.open && R() < dt * 2.2) parts.push({ x: b.x + rr(-20, 20), y: b.y + rr(-10, 10), vx: rr(-20, 30), vy: rr(10, 40), life: 0, max: rr(3, 6), size: rr(3, 6), color: b.hue, drag: 0.2, g: 4 });
  finale.bloom = clamp((t - 2) / 50, 0, 1);
  const audioDone = finale.audio ? (themeAudio.ended || t >= 59.6) : t >= 60;
  if (t > 53) fadeTarget = 0; // keep scene visible; end overlay handles the light
  if (finale.started && audioDone) { state = 'end'; stateT = 0; for (let i = 0; i < 160; i++) parts.push({ x: rr(-500, 500), y: TREE_CENTER.y + rr(-300, 200), vx: rr(-10, 10), vy: rr(-80, -20), life: 0, max: rr(4, 9), size: rr(3, 8), color: HUES[i % HUES.length], drag: 0.1 }); }
}

// ---------- drawing ----------
function setCam(f = 1, extraScale = 1) {
  const s = cv.height / viewH * extraScale; const sx = cam.shake ? (R() - 0.5) * cam.shake : 0, sy = cam.shake ? (R() - 0.5) * cam.shake : 0;
  ctx.setTransform(s, 0, 0, s, cv.width / 2 - (cam.x * f) * s + sx, cv.height / 2 - (cam.y * f) * s + sy);
}
const SKY = [
  [0, '#05071a', '#141a48'], [0.25, '#07091f', '#221a46'], [0.55, '#151744', '#55355f'], [0.8, '#2d3270', '#b5706a'], [1, '#5b6db0', '#f4c58e'], [1.25, '#8fa6dd', '#ffe6b8']];
function skyAt(p) {
  for (let i = 0; i < SKY.length - 1; i++) if (p <= SKY[i + 1][0]) { const t = (p - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]); return [mix(hex(SKY[i][1]), hex(SKY[i + 1][1]), t), mix(hex(SKY[i][2]), hex(SKY[i + 1][2]), t)]; }
  const l = SKY[SKY.length - 1]; return [hex(l[1]), hex(l[2])];
}
function heightProgress() {
  let pr = clamp((GROUND_Y - cam.y) / (GROUND_Y - TREE_Y), 0, 1) * 0.82;
  if (finale) pr = 0.82 + (finale.bloom || 0) * 0.43;
  return pr;
}
function draw() {
  const pr = heightProgress();
  const [top, bot] = skyAt(pr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  // stars
  const starA = 1 - smooth((pr - 0.6) / 0.5);
  if (starA > 0) { ctx.fillStyle = '#fff'; for (const s of stars) { const sx = ((s.x * cv.width - cam.x * 0.03 * DPR) % cv.width + cv.width) % cv.width; const sy = ((s.y * cv.height - cam.y * 0.05 * DPR) % cv.height + cv.height) % cv.height; ctx.globalAlpha = starA * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.f + s.p))) * 0.8; ctx.fillRect(sx, sy, s.s * DPR, s.s * DPR); } ctx.globalAlpha = 1; }
  // dawn sun glow near the top
  if (pr > 0.55) { ctx.globalCompositeOperation = 'lighter'; const a = smooth((pr - 0.55) / 0.6); const r = cv.height * (0.6 + a * 0.6); const gg = ctx.createRadialGradient(cv.width / 2, cv.height * 1.05, 0, cv.width / 2, cv.height * 1.05, r); gg.addColorStop(0, `rgba(255,200,140,${0.35 * a})`); gg.addColorStop(1, 'rgba(255,200,140,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-over'; }

  const silBase = mix(bot, [0, 0, 0], 0.72);
  // far hills
  farHills.forEach((h, k) => { setCam(h.f); ctx.fillStyle = rgb(mix(silBase, bot, 0.45 - k * 0.2)); ctx.beginPath(); ctx.moveTo(h.pts[0][0], 4000); h.pts.forEach(q => ctx.lineTo(q[0], q[1] + (1 - h.f) * GROUND_Y * 0.4)); ctx.lineTo(h.pts[h.pts.length - 1][0], 4000); ctx.fill(); });
  // far islands
  for (const s of islands) if (s.f < 1) drawIsland(s, rgb(mix(silBase, bot, s.f < 0.5 ? 0.55 : 0.35)));

  setCam(1);
  // updraft streaks
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(190,210,255,0.16)'; ctx.lineWidth = 2;
  ctx.beginPath(); for (const d of draftParts) { const x = d.d.x + d.x + Math.sin(d.y * 0.01) * 10; ctx.moveTo(x, d.y); ctx.lineTo(x, d.y + 40); } ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
  // near islands
  for (const s of islands) if (s.f === 1) drawIsland(s, rgb(silBase));
  // ground & grass
  drawGround(silBase);
  // tree
  drawIsland(treeIsland, rgb(silBase)); drawTree(silBase);
  // mists
  drawMists();
  // veils
  for (const v of veils) drawVeil(v);

  // fog of darkness
  drawFog(pr);

  // lights
  setCam(1);
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flowers) if (f.open > 0.01) drawFlower(f);
  drawRim();
  drawBuds();
  for (const m of motes) drawMote(m);
  for (const q of parts) { const t = q.life / q.max; drawGlow(q.color, q.x, q.y, q.size * (1 - t * 0.5) * 2.2, (1 - t) * 0.9); }
  for (const w of waves) { ctx.strokeStyle = w.harmony ? `rgba(255,226,160,${w.a * 0.7})` : `rgba(180,205,255,${w.a * 0.5})`; ctx.lineWidth = w.harmony ? 5 : 3; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke(); }
  drawPlayer();
  ctx.globalCompositeOperation = 'source-over';

  // vignette
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.35, cv.width / 2, cv.height / 2, cv.height * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,8,${0.55 - pr * 0.25})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height);

  drawOverlay();
  if (fade > 0.002) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(3,3,10,${fade})`; ctx.fillRect(0, 0, cv.width, cv.height); }
}

function drawIsland(s, color) {
  setCam(s.f);
  ctx.save(); ctx.translate(s.x, s.y + (s.f < 1 ? (1 - s.f) * 600 : 0));
  ctx.fillStyle = color; ctx.beginPath(); s.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (const r of s.roots) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x, s.ry * 0.4); ctx.quadraticCurveTo(r.x + Math.sin(time * 0.6 + r.p) * 10, s.ry * 0.4 + r.l * 0.5, r.x + Math.sin(time * 0.5 + r.p) * 18, s.ry * 0.4 + r.l); ctx.stroke(); }
  // grass tufts on top
  ctx.lineWidth = 2; ctx.beginPath(); for (let x = -s.rx * 0.8; x < s.rx * 0.8; x += 9) { const h = 8 + 8 * Math.sin(x * 1.7 + s.x); ctx.moveTo(x, -s.ry * 0.5); ctx.lineTo(x + Math.sin(time + x) * 3, -s.ry * 0.5 - h); } ctx.stroke();
  ctx.restore();
}
function drawGround(col) {
  if (cam.y - viewH > GROUND_Y + 200) return;
  setCam(1); ctx.fillStyle = rgb(col); ctx.beginPath(); ctx.moveTo(-WORLD_HALF - 900, GROUND_Y + 900);
  for (let x = -WORLD_HALF - 900; x <= WORLD_HALF + 900; x += 30) ctx.lineTo(x, groundAt(x)); ctx.lineTo(WORLD_HALF + 900, GROUND_Y + 900); ctx.fill();
  ctx.strokeStyle = rgb(col); ctx.lineCap = 'round'; ctx.lineWidth = 2.2; ctx.beginPath();
  const vw = viewH * cv.width / cv.height;
  for (const b of grass) { if (Math.abs(b.x - cam.x) > vw / 2 + 80) continue; const gy = groundAt(b.x); const d = b.x - player.x; const push = Math.abs(d) < 90 && Math.abs(player.y - gy) < 140 ? Math.sign(d) * (90 - Math.abs(d)) * 0.25 : 0;
    const sw = Math.sin(time * 1.2 + b.p + b.x * 0.004) * 6 + push + b.lean * b.h; ctx.moveTo(b.x, gy + 4); ctx.quadraticCurveTo(b.x + sw * 0.3, gy - b.h * 0.5, b.x + sw, gy - b.h); }
  ctx.stroke();
  for (const f of flowers) { ctx.beginPath(); ctx.moveTo(f.x, groundAt(f.x) + 2); ctx.quadraticCurveTo(f.x - 4, (f.y + groundAt(f.x)) / 2, f.x + Math.sin(time + f.p) * 3, f.y); ctx.stroke(); ctx.fillStyle = rgb(col); ctx.beginPath(); ctx.arc(f.x + Math.sin(time + f.p) * 3, f.y, 5, 0, TAU); ctx.fill(); }
}
function drawRim() {
  // moonlit rim on grass and ground near the wisp and its companions
  if (player.y < VEIL1 - 300 || state === 'title' && false) return;
  const lights = [{ x: player.x, y: player.y, r: 150 + Math.min(chain.length, 18) * 14 }];
  for (const w of waves) lights.push({ x: w.x, y: w.y, r: w.r, a: w.a });
  const vw = viewH * cv.width / cv.height; ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
  for (const b of grass) {
    if (Math.abs(b.x - cam.x) > vw / 2 + 80) continue; const gy = groundAt(b.x);
    let a = 0; for (const L of lights) { const d = dist(b.x, gy - b.h / 2, L.x, L.y); if (d < L.r) a = Math.max(a, (1 - d / L.r) * (L.a === undefined ? 1 : L.a * 0.6)); }
    if (a < 0.02) continue;
    const d0 = b.x - player.x; const push = Math.abs(d0) < 90 && Math.abs(player.y - gy) < 140 ? Math.sign(d0) * (90 - Math.abs(d0)) * 0.25 : 0;
    const sw = Math.sin(time * 1.2 + b.p + b.x * 0.004) * 6 + push + b.lean * b.h;
    ctx.strokeStyle = `rgba(150,185,255,${a * 0.55})`; ctx.beginPath(); ctx.moveTo(b.x, gy + 4); ctx.quadraticCurveTo(b.x + sw * 0.3, gy - b.h * 0.5, b.x + sw, gy - b.h); ctx.stroke();
  }
  ctx.lineWidth = 2.5;
  for (let x = cam.x - vw / 2 - 30; x < cam.x + vw / 2 + 30; x += 12) { const gy = groundAt(x); let a = 0; for (const L of lights) { const d = dist(x, gy, L.x, L.y); if (d < L.r * 1.2) a = Math.max(a, (1 - d / (L.r * 1.2)) * (L.a === undefined ? 1 : L.a * 0.6)); } if (a < 0.02) continue; ctx.strokeStyle = `rgba(150,185,255,${a * 0.45})`; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 12, groundAt(x + 12)); ctx.stroke(); }
}
function drawFlower(f) {
  const x = f.x + Math.sin(time + f.p) * 3, y = f.y; const o = smooth(f.open);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + time * 0.2; drawGlow(f.hue, x + Math.cos(a) * 7 * o, y + Math.sin(a) * 7 * o, 9 * o, 0.7 * o); }
  drawGlow('#fff4d6', x, y, 10 * o, 0.6 * o); drawGlow(f.hue, x, y, 40 * o, 0.25 * o);
}
function drawTree(col) {
  if (cam.y + viewH < TREE_Y - 900 || cam.y - viewH > TREE_Y + 600) return;
  setCam(1); ctx.lineCap = 'round'; ctx.strokeStyle = rgb(col);
  const sway = (d) => Math.sin(time * 0.6 + d) * d * 0.4;
  for (const s of segs) { ctx.lineWidth = Math.max(1.2, s.w); ctx.beginPath(); ctx.moveTo(s.x1 + sway(s.d - 1), s.y1); ctx.lineTo(s.x2 + sway(s.d), s.y2); ctx.stroke(); }
  const b = finale ? (finale.bloom || 0) : 0;
  if (b > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,214,150,${0.12 + b * 0.45})`; for (const s of segs) { ctx.lineWidth = Math.max(0.8, s.w * 0.3); ctx.beginPath(); ctx.moveTo(s.x1 + sway(s.d - 1) - s.w * 0.25, s.y1); ctx.lineTo(s.x2 + sway(s.d) - s.w * 0.25, s.y2); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; }
}
function drawBuds() {
  for (const t of tips) if (t.open > 0.02) { const x = t.x, y = t.y; const hue = buds[t.bud] ? buds[t.bud].hue : '#ffd27a'; drawGlow(hue, x, y, 16 * t.open, 0.8 * t.open); drawGlow('#fff4d6', x, y, 6 * t.open, 0.7 * t.open); }
  if (state !== 'finale') return;
  for (const b of buds) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    if (!b.open) { const near = clamp(1 - Math.abs(finale.t - b.cue) / 1.5, 0, 1); drawGlow(b.hue, b.x, b.y, 10 + near * 30, 0.25 + near * 0.6 * pulse); }
    else { drawGlow(b.hue, b.x, b.y, 60 + b.glow * 60, 0.45 + b.glow * 0.3); drawGlow('#fff4d6', b.x, b.y, 14, 0.9); }
  }
}
function drawMists() {
  setCam(1);
  for (const s of mists) {
    if (Math.abs(s.y - cam.y) > viewH) continue;
    const calm = clamp(s.calm, 0, 1); const a = 0.85 * (1 - calm * 0.75);
    for (let i = 0; i < 6; i++) { const ang = time * 0.3 * (i % 2 ? 1 : -1) + i; const x = s.x + Math.cos(ang) * s.r * 0.35, y = s.y + Math.sin(ang * 1.3) * s.r * 0.25; const gg = ctx.createRadialGradient(x, y, 0, x, y, s.r * 0.8); gg.addColorStop(0, `rgba(8,5,18,${a * 0.5})`); gg.addColorStop(0.6, `rgba(30,18,52,${a * 0.25})`); gg.addColorStop(1, 'rgba(30,18,52,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, s.r * 0.8, 0, TAU); ctx.fill(); }
    // two dim eyes of cold light
    if (calm < 0.5) { ctx.globalCompositeOperation = 'lighter'; drawGlow('#6f6aa8', s.x - 12, s.y - 4, 10, 0.35 * (1 - calm * 2)); drawGlow('#6f6aa8', s.x + 12, s.y - 4, 10, 0.35 * (1 - calm * 2)); ctx.globalCompositeOperation = 'source-over'; }
  }
}
function drawVeil(v) {
  if (Math.abs(v.y - cam.y) > viewH * 1.2) return;
  setCam(1); const a = 1 - smooth(v.fade); if (a <= 0.01) return;
  const vw = viewH * cv.width / cv.height + 400;
  for (let i = 0; i < 3; i++) { const yy = v.y - 40 - i * 50; const gg = ctx.createLinearGradient(0, yy - 120, 0, yy + 80); gg.addColorStop(0, 'rgba(6,4,16,0)'); gg.addColorStop(0.5, `rgba(10,7,26,${0.75 * a})`); gg.addColorStop(1, 'rgba(6,4,16,0)'); ctx.fillStyle = gg; ctx.fillRect(cam.x - vw / 2, yy - 120 + Math.sin(time * 0.5 + i) * 10, vw, 200); }
  // wordless progress: dots on the veil
  ctx.globalCompositeOperation = 'lighter';
  const n = v.need, lit = Math.min(chain.length, n), gap = 34, x0 = player.x - (n - 1) * gap / 2;
  for (let i = 0; i < n; i++) { const on = i < lit; drawGlow(on ? HUES[i % HUES.length] : '#8a86b8', x0 + i * gap, v.y + 10, on ? 22 : 10, (on ? 0.85 : 0.35) * a); }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFog(pr) {
  let base = player.y > VEIL1 ? 0.9 : player.y > VEIL2 ? lerp(0.86, 0.6, clamp((VEIL1 - player.y) / (VEIL1 - VEIL2), 0, 1)) : 0.35;
  if (state === 'finale' || state === 'end') base = 0.35 * (1 - (finale ? finale.bloom : 1));
  if (state === 'title') base = 0.9;
  fogA = lerp(fogA, base, 0.03);
  if (fogA < 0.01) return;
  const fw = fog.width, fh = fog.height; const s = fh / viewH;
  fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, fw, fh);
  fctx.fillStyle = `rgba(3,3,12,${fogA})`; fctx.fillRect(0, 0, fw, fh);
  fctx.setTransform(s, 0, 0, s, fw / 2 - cam.x * s, fh / 2 - cam.y * s);
  fctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => { const gg = fctx.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(0,0,0,${a})`); gg.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); gg.addColorStop(1, 'rgba(0,0,0,0)'); fctx.fillStyle = gg; fctx.beginPath(); fctx.arc(x, y, r, 0, TAU); fctx.fill(); };
  const pulse = 1 + 0.06 * Math.sin((beatT / BEAT) * TAU);
  hole(player.x, player.y, (130 + Math.min(chain.length, 18) * 13) * pulse);
  for (const m of chain) hole(m.x, m.y, 55, 0.6);
  for (const m of motes) if (m.state === 'fly' || m.state === 'placed') hole(m.x, m.y, 80, 0.8);
  for (const f of flowers) if (f.open > 0.1) hole(f.x, f.y, 60 * f.open, 0.5);
  for (const w of waves) hole(w.x, w.y, w.r, 0.55 * w.a);
  for (const b of buds) if (b.open) hole(b.x, b.y, 140, 0.8);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(fog, 0, 0, cv.width, cv.height);
}
let fogA = 0.94;
function drawMote(m) {
  const br = 0.5 + 0.5 * Math.sin(m.p * 2.1);
  if (m.state === 'sleep') { drawGlow(m.hue, m.x, m.y, 26 + br * 8, 0.32 + br * 0.15); drawGlow('#ffffff', m.x, m.y, 5, 0.5); return; }
  const beat = 1 + 0.18 * Math.max(0, Math.cos((beatT / BEAT) * TAU));
  drawGlow(m.hue, m.x, m.y, (38 + m.wake * 40) * beat, 0.75); drawGlow('#fff7e6', m.x, m.y, 9, 0.9);
}
function drawPlayer() {
  const p = player; if (state === 'end') return;
  // ribbon trail
  ctx.lineCap = 'round';
  for (let i = 2; i < Math.min(trail.length, 60); i += 2) { const t = i / 60; drawGlow('#bfe0ff', trail[i].x, trail[i].y, 22 * (1 - t), 0.18 * (1 - t)); }
  const beat = 1 + 0.12 * Math.max(0, Math.cos((beatT / BEAT) * TAU));
  const flick = p.invuln > 0 ? 0.5 + 0.5 * Math.sin(time * 30) : 1;
  drawGlow('#9fd0ff', p.x, p.y, 90 * beat, 0.45 * flick); drawGlow('#e8f4ff', p.x, p.y, 34 * beat, 0.9 * flick); drawGlow('#ffffff', p.x, p.y, 10, 1);
  // charging: a ring that closes in on the heartbeat
  if (p.charging) {
    const ph = beatT / BEAT; const toBeat = 1 - ph; const r = 26 + toBeat * 70; const near = beatCloseness() < 0.2;
    ctx.strokeStyle = near ? 'rgba(255,226,160,0.85)' : `rgba(200,220,255,${0.25 + 0.35 * p.charge})`; ctx.lineWidth = near ? 4 : 2; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(230,240,255,${0.5 * p.charge})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + TAU * p.charge); ctx.stroke();
  }
}
const SERIF = "'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif";
function text(str, x, y, size, a, italic = false, color = '235,232,255') {
  ctx.font = `${italic ? 'italic ' : ''}${size * DPR}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = `rgba(${color},${a})`; ctx.fillText(str, x, y);
}
function drawOverlay() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); const cx = cv.width / 2, h = cv.height; const u = Math.min(1, cv.width / (900 * DPR)) * Math.min(1, h / (600 * DPR)) ** 0.3;
  if (state === 'title') {
    const a = smooth(stateT / 2.5);
    text('Hush, Then Bloom', cx, h * 0.3, 64 * Math.max(0.6, u), a, true);
    text('a small wordless journey', cx, h * 0.3 + 52 * DPR * Math.max(0.6, u), 18, a * 0.6, true);
    text('move — mouse, touch, or WASD / arrows', cx, h * 0.74, 15, a * 0.55);
    text('hold & release — click or Space — to sing;  release on the heartbeat to sing brighter', cx, h * 0.74 + 24 * DPR, 15, a * 0.55);
    text('headphones recommended  ·  F for fullscreen', cx, h * 0.74 + 48 * DPR, 13, a * 0.4);
    text('click to begin', cx, h * 0.88, 18, a * (0.45 + 0.35 * Math.sin(time * 2)), true);
  }
  if (state === 'end') {
    const a = smooth((stateT - 1.2) / 2.5);
    ctx.fillStyle = `rgba(252,240,220,${0.62 * smooth((stateT - 0.3) / 3.5)})`; ctx.fillRect(0, 0, cv.width, h);
    text('Hush, Then Bloom', cx, h * 0.34, 54 * Math.max(0.6, u), a, true, '40,30,60');
    text('every small light was carried home', cx, h * 0.34 + 50 * DPR, 18, a * 0.75, true, '50,36,70');
    text('theme music by Jason Grace (thatgamejam #02)', cx, h * 0.72, 14, a * 0.7, false, '50,36,70');
    text('made by Rajesh Mullippa with Hark, an AI agent', cx, h * 0.72 + 22 * DPR, 14, a * 0.7, false, '50,36,70');
    if (stateT > 3) text('click to play again', cx, h * 0.88, 16, a * (0.4 + 0.3 * Math.sin(time * 2)), true, '50,36,70');
  }
}

// ---------- loop ----------
let last = performance.now();
let manual = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!manual) { update(dt); draw(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- test hooks (used for automated screenshots) ----------
window.HTB = {
  get state() { return state; }, player, chain, motes, buds: () => buds, finale: () => finale,
  start() { startGame(); fadeTarget = 0; fade = 0; },
  give(n) { for (const m of motes) { if (n <= 0) break; if (m.state === 'sleep') { wakeMote(m); n--; } } },
  tp(x, y) { player.x = x; player.y = y; cam.x = x; cam.y = y; trail.length = 0; },
  openVeils(k) { for (let i = 0; i < k; i++) { veils[i].open = true; veils[i].fade = 1; } },
  sing(c = 1) { sing(c); },
  step(sec) { for (let t = 0; t < sec; t += 1 / 60) update(1 / 60); draw(); },
  auto(on = true) { auto.on = on; },
  manual(on = true) { manual = on; },
  frame(dt, q = 0.82) { update(dt); draw(); return cv.toDataURL('image/jpeg', q); },
  finaleTime() { return finale ? finale.t : -1; },
  forceFinale() { if (state !== 'finale') startFinale(); finale.started = true; finale.audio = false; },
  finaleAt(sec) { if (state !== 'finale') startFinale(); finale.started = true; finale.audio = false; while (state === "finale" && finale.t < sec) update(1 / 60); },
};
const q = new URLSearchParams(location.search);
if (q.get('nofade')) { fade = 0; }
})();
