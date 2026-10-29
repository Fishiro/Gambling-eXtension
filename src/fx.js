import { PALETTE, spriteCanvas } from "./sprites.js";

const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d");
const particles = [];
const labels = [];
const rings = [];
const SYSTEM_CALM = matchMedia("(prefers-reduced-motion: reduce)").matches;
let reducedMotion = SYSTEM_CALM;
let frameFx = true;

// Settings: calm mode (no shakes, fewer particles, CSS motion stopped) and the frame light show.
export function setCalm(on) {
    reducedMotion = SYSTEM_CALM || on;
    document.body.classList.toggle("is-calm", on);
}

export function setFrameFx(on) {
    frameFx = on;
    if (!on) frameMode(null);
}
const GRID = 2;
// Keep floating text clear of the gold frame (frame + gap, see --inset) with a little air.
const SAFE = 24;
const RAINBOW = ["y", "R", "r", "v", "B", "c", "G"].map((c) => PALETTE[c]);
const stars = Array.from({ length: 80 }, () => ({ x: Math.random(), y: Math.random(), phase: Math.random() * 6, big: Math.random() > 0.85 }));
let storm = null;
let aura = null;
let running = false;
let last = 0;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const range = ([lo, hi]) => lo + Math.random() * (hi - lo);
const color = (c) => PALETTE[c] ?? c;

function fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width === Math.round(w * dpr) && canvas.height === Math.round(h * dpr)) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
}

function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
}

function drawStorm(now) {
    const age = now - storm.t0;
    if (age > storm.dur) {
        storm = null;
        return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const fade = Math.min(1, age / 500, (storm.dur - age) / 800);
    ctx.globalAlpha = 0.72 * fade;
    ctx.fillStyle = "#0d0a23";
    ctx.fillRect(0, 0, w, h);
    stars.forEach((s) => {
        const on = Math.sin(now / 160 + s.phase) > -0.2;
        if (!on) return;
        ctx.fillStyle = s.big ? PALETTE.c : PALETTE.w;
        const size = s.big ? 4 : 2;
        ctx.fillRect(Math.round((s.x * w) / GRID) * GRID, Math.round((s.y * h + age * (s.big ? 0.03 : 0.012)) % h / GRID) * GRID, size, size);
    });
    const cx = w / 2;
    const cy = storm.y;
    for (let k = 0; k < 14; k++) {
        const r = ((age - k * 320) / 1000) * 260;
        if (r <= 0 || r > Math.max(w, h)) continue;
        ctx.globalAlpha = fade * Math.max(0, 1 - r / Math.max(w, h));
        ctx.fillStyle = RAINBOW[(k + Math.floor(now / 90)) % RAINBOW.length];
        const steps = Math.max(24, Math.floor(r / 3));
        for (let i = 0; i < steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            ctx.fillRect(Math.round((cx + Math.cos(a) * r) / 4) * 4, Math.round((cy + Math.sin(a) * r) / 4) * 4, 4, 4);
        }
    }
    ctx.globalAlpha = 1;
}

function drawAura(now, dt) {
    aura.current += (aura.target - aura.current) * Math.min(1, 0.06 * dt);
    if (aura.target === 0 && aura.current < 0.01) {
        aura = null;
        return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pulse = 0.85 + Math.sin(now / 140) * 0.15;
    const thick = Math.round((8 + aura.current * 28) / 4) * 4;
    for (let d = 0; d < thick; d += 4) {
        ctx.globalAlpha = aura.current * pulse * 0.55 * (1 - d / thick);
        ctx.fillStyle = aura.rainbow ? RAINBOW[(Math.floor(now / 80) + d / 4) % RAINBOW.length] : color(aura.glow);
        ctx.fillRect(d, d, w - d * 2, 4);
        ctx.fillRect(d, h - d - 4, w - d * 2, 4);
        ctx.fillRect(d, d, 4, h - d * 2);
        ctx.fillRect(w - d - 4, d, 4, h - d * 2);
    }
    ctx.globalAlpha = 1;
    if (aura.target > 0 && Math.random() < aura.current * dt) {
        const side = Math.random() < 0.5 ? Math.random() * thick : w - Math.random() * thick;
        burst(Math.random() < 0.6 ? Math.random() * w : side, h - 4, {
            count: 1 + Math.round(aura.current * 2),
            colors: aura.colors,
            angle: -Math.PI / 2,
            spread: 0.6,
            speed: [1, 2.5 + aura.current * 2],
            gravity: -0.02,
            drag: 0.99,
            life: [40, 80],
        });
    }
    if (aura.stars && aura.target > 0) {
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? PALETTE.w : PALETTE.c;
            const edge = Math.random() < 0.5;
            const x = edge ? Math.random() * w : Math.random() < 0.5 ? Math.random() * thick : w - Math.random() * thick;
            const y = edge ? (Math.random() < 0.5 ? Math.random() * thick : h - Math.random() * thick) : Math.random() * h;
            ctx.fillRect(Math.round(x / GRID) * GRID, Math.round(y / GRID) * GRID, 2, 2);
        }
    }
}

function frame(now) {
    const dt = Math.min(3, (now - last) / 16.67);
    last = now;
    fit();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (storm) drawStorm(now);
    if (aura) drawAura(now, dt);

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= p.drag ** dt;
        p.vy = p.vy * p.drag ** dt + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        const t = p.life / p.max;
        const x = Math.round(p.x / GRID) * GRID;
        const y = Math.round(p.y / GRID) * GRID;
        if (p.sprite) {
            ctx.globalAlpha = Math.min(1, t * 3);
            const img = spriteCanvas(p.sprite);
            ctx.drawImage(img, x, y, img.width * 2, img.height * 2);
            ctx.globalAlpha = 1;
            continue;
        }
        const size = Math.max(GRID, Math.round((p.size * Math.min(1, t * 2)) / GRID) * GRID);
        ctx.fillStyle = p.color;
        ctx.fillRect(x, y, size, size);
    }

    for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life -= dt;
        if (r.life <= 0) {
            rings.splice(i, 1);
            continue;
        }
        const t = 1 - r.life / r.max;
        const half = Math.round((r.from + (r.to - r.from) * (1 - (1 - t) ** 2)) / GRID) * GRID;
        const x = Math.round(r.x / GRID) * GRID - half;
        const y = Math.round(r.y / GRID) * GRID - half;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = GRID;
        ctx.strokeRect(x + 1, y + 1, half * 2, half * 2);
        ctx.globalAlpha = 1;
    }

    for (let i = labels.length - 1; i >= 0; i--) {
        const l = labels[i];
        l.life -= dt;
        if (l.life <= 0) {
            labels.splice(i, 1);
            continue;
        }
        const age = l.max - l.life;
        const pop = age < 6 ? 0.6 + (age / 6) * 0.5 : 1.1 - Math.min(0.1, (age - 6) / 40);
        const size = Math.round(l.size * pop);
        ctx.globalAlpha = Math.min(1, l.life / 12);
        ctx.font = `700 ${size}px Silkscreen, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const half = ctx.measureText(l.text).width / 2;
        const x = Math.min(Math.max(l.x, SAFE + half), window.innerWidth - SAFE - half);
        const y = Math.min(Math.max(Math.round(l.y - age * l.rise), SAFE + size / 2), window.innerHeight - SAFE - size / 2);
        ctx.fillStyle = PALETTE.k;
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [0, 3]]) ctx.fillText(l.text, x + dx, y + dy);
        ctx.fillStyle = l.rainbow ? RAINBOW[Math.floor(now / 70) % RAINBOW.length] : l.color;
        ctx.fillText(l.text, x, y);
        ctx.globalAlpha = 1;
    }

    if (particles.length || labels.length || rings.length || storm || aura) requestAnimationFrame(frame);
    else running = false;
}

export function ripple(x, y, c = "w", { from = 4, to = 22, life = 14 } = {}) {
    if (reducedMotion) return;
    rings.push({ x, y, color: color(c), from, to, life, max: life });
    start();
}

// 4. Spring release: the button pops a little past its rest position, then settles.
const SPRING = [{ transform: "translateY(2px)" }, { transform: "translateY(-3px)" }, { transform: "translateY(1px)" }, { transform: "translateY(0)" }];

export function spring(el) {
    if (reducedMotion || !el) return;
    el.animate(SPRING, { duration: 200, easing: "steps(4)" });
}

// The frame ring's mode: "spin" until cleared, or a result reaction for `ms`.
// Leaving a mode never snaps: the ring fades out over the gold rim first (data-frame-out),
// then the mode is dropped and the resting glint fades back in.
const FRAME_FADE_MS = 600;
let frameTimer = 0;
export function frameMode(mode, ms = 0) {
    if (!frameFx) mode = null;
    clearTimeout(frameTimer);
    const body = document.body;
    delete body.dataset.frameOut;
    delete body.dataset.frame;
    if (!mode) return;
    void body.offsetWidth;
    body.dataset.frame = mode;
    if (!ms) return;
    frameTimer = setTimeout(() => {
        body.dataset.frameOut = "";
        frameTimer = setTimeout(() => {
            delete body.dataset.frameOut;
            delete body.dataset.frame;
        }, FRAME_FADE_MS);
    }, ms);
}

// 3. The gold window frame flares once.
export function gild() {
    if (reducedMotion) return;
    document.body.classList.remove("is-gilding");
    void document.body.offsetWidth;
    document.body.classList.add("is-gilding");
}

export function burst(x, y, opts = {}) {
    const {
        count = 10,
        colors = ["y", "w"],
        speed = [1.5, 3.5],
        angle = -Math.PI / 2,
        spread = Math.PI * 2,
        gravity = 0.15,
        drag = 0.97,
        size = [2, 4],
        life = [20, 36],
        sprite = null,
    } = opts;
    const n = reducedMotion ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const v = range(speed);
        const max = range(life);
        particles.push({
            x,
            y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            gravity,
            drag,
            size: range(size),
            color: color(pick(colors)),
            life: max,
            max,
            sprite,
        });
    }
    start();
}

export function float(x, y, text, opts = {}) {
    const { color: c = "y", size = 16, rise = 0.7, life = 60, rainbow = false } = opts;
    labels.push({ x, y, text, color: color(c), size, rise, life, max: life, rainbow });
    start();
}

export function coinShower(x, y, count) {
    burst(x, y, { count, sprite: "coin", speed: [2, 5], spread: Math.PI * 0.9, gravity: 0.2, drag: 0.99, life: [40, 70] });
    burst(x, y, { count: count * 2, colors: ["y", "Y", "w"], speed: [1, 4], life: [20, 40] });
}

export function confetti(intensity = 1) {
    const w = window.innerWidth;
    const colors = ["y", "R", "r", "G", "c", "B", "w"];
    for (let i = 0; i < 6 * intensity; i++) {
        burst(Math.random() * w, -4, {
            count: 8,
            colors,
            angle: Math.PI / 2,
            spread: 1.2,
            speed: [1, 3],
            gravity: 0.06,
            drag: 0.985,
            life: [60, 110],
            size: [2, 4],
        });
    }
}

export function setAura(cfg) {
    if (!cfg) {
        if (aura) aura.target = 0;
        return;
    }
    aura = { ...cfg, current: aura?.current ?? 0, target: reducedMotion ? cfg.intensity / 2 : cfg.intensity };
    start();
}

export function cosmicStorm(y, duration = 6000) {
    storm = { t0: performance.now(), dur: reducedMotion ? 1500 : duration, y };
    start();
}

export function cosmicBurst(x, y) {
    burst(x, y, { count: 120, colors: ["y", "R", "v", "B", "c", "G", "w"], speed: [2, 8], drag: 0.96, gravity: 0.05, life: [40, 90], size: [2, 6] });
    coinShower(x, y, 40);
    confetti(5);
}

export function shake(el, power = 3, duration = 280) {
    if (reducedMotion || !el) return;
    const frames = Array.from({ length: 8 }, (_, i) => {
        const p = power * (1 - i / 8);
        return { transform: `translate(${Math.round((Math.random() - 0.5) * 2 * p)}px, ${Math.round((Math.random() - 0.5) * 2 * p)}px)` };
    });
    el.animate([...frames, { transform: "translate(0, 0)" }], { duration, easing: "steps(9)" });
}

export function pop(el) {
    if (reducedMotion || !el) return;
    el.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 220, easing: "steps(4)" });
}

export const centerOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
