import { SYMBOLS } from "./core/config.js";
import { PALETTE, drawSprite } from "./sprites.js";
import { rollSymbol, clamp } from "./core/economy.js";

const CELL = 16;
const REEL_W = 20;
const GAP = 3;
const PAD = 3;
const VIEW_H = 28;
const W = PAD * 2 + REEL_W * 3 + GAP * 2;
const H = PAD * 2 + VIEW_H;
const STRIP_LEN = 30;
const MAX_SPEED = 20;
const ACCEL = 90;
const BACK = 1.2;

const mod = (n, m) => ((n % m) + m) % m;
const easeOutBack = (x) => 1 + (BACK + 1) * (x - 1) ** 3 + BACK * (x - 1) ** 2;

function makeStrip() {
    const strip = SYMBOLS.map((s) => s.id);
    while (strip.length < STRIP_LEN) strip.push(rollSymbol());
    for (let i = strip.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [strip[i], strip[j]] = [strip[j], strip[i]];
    }
    return strip;
}

export function createReels(canvas, { onReelStop, onReelTick } = {}) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const reels = [0, 1, 2].map(() => ({
        strip: makeStrip(),
        pos: Math.floor(Math.random() * STRIP_LEN),
        cell: 0,
        v: 0,
        mode: "idle",
        startAt: 0,
        from: 0,
        to: 0,
        t0: 0,
        dur: 0,
        done: null,
    }));
    let pending = [];
    let highlight = { cells: [], until: 0 };
    let teaseReel = -1;
    let glowMode = null;
    let last = performance.now();

    function update(now, dt) {
        reels.forEach((r, i) => {
            if (r.mode === "spin" && now >= r.startAt) {
                const cap = teaseReel >= 0 && r === reels[teaseReel] ? MAX_SPEED * 0.55 : MAX_SPEED;
                r.v = r.v > cap ? Math.max(cap, r.v - ACCEL * dt) : Math.min(cap, r.v + ACCEL * dt);
                r.pos += r.v * dt;
            } else if (r.mode === "stop") {
                const x = Math.min(1, (now - r.t0) / r.dur);
                const prev = r.pos;
                r.pos = r.from + (r.to - r.from) * easeOutBack(x);
                r.v = dt > 0 ? (r.pos - prev) / dt : 0;
                if (x >= 1) {
                    r.pos = mod(r.to, STRIP_LEN);
                    r.cell = r.pos;
                    r.v = 0;
                    r.mode = "idle";
                    const done = r.done;
                    r.done = null;
                    done?.();
                    return;
                }
            }
            // Every symbol that crosses the payline clicks, so the clicks slow down with the reel.
            const cell = Math.round(r.pos);
            if (cell !== r.cell) {
                r.cell = cell;
                if (r.mode !== "idle") onReelTick?.(i, Math.min(1, Math.abs(r.v) / MAX_SPEED));
            }
        });
    }

    function drawReel(r, i, now) {
        const x0 = PAD + i * (REEL_W + GAP);
        const y0 = PAD;
        const mid = y0 + VIEW_H / 2;
        ctx.fillStyle = PALETTE.k;
        ctx.fillRect(x0 - 1, y0 - 1, REEL_W + 2, VIEW_H + 2);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, REEL_W, VIEW_H);
        ctx.clip();
        ctx.fillStyle = PALETTE.w;
        ctx.fillRect(x0, y0, REEL_W, VIEW_H);

        const base = Math.floor(r.pos);
        const blur = Math.abs(r.v) > 9;
        for (let idx = base - 1; idx <= base + 2; idx++) {
            const sym = r.strip[mod(idx, STRIP_LEN)];
            const y = Math.round(mid + (r.pos - idx) * CELL - 6);
            const x = x0 + 4;
            if (blur) {
                ctx.globalAlpha = 0.3;
                drawSprite(ctx, sym, x, y - 5);
                ctx.globalAlpha = 0.15;
                drawSprite(ctx, sym, x, y - 10);
                ctx.globalAlpha = 1;
            }
            drawSprite(ctx, sym, x, y);
        }

        ctx.fillStyle = "rgba(26, 28, 44, 0.5)";
        ctx.fillRect(x0, y0, REEL_W, 2);
        ctx.fillRect(x0, y0 + VIEW_H - 2, REEL_W, 2);
        ctx.fillStyle = "rgba(26, 28, 44, 0.22)";
        ctx.fillRect(x0, y0 + 2, REEL_W, 3);
        ctx.fillRect(x0, y0 + VIEW_H - 5, REEL_W, 3);
        ctx.restore();

        const blink = Math.floor(now / 110) % 2 === 0;
        if (highlight.cells.includes(i) && now < highlight.until) {
            outline(x0, mid - 8, REEL_W, 16, blink ? PALETTE.y : PALETTE.R);
        }
        if (teaseReel === i && r.mode === "spin") {
            outline(x0 - 1, y0 - 1, REEL_W + 2, VIEW_H + 2, blink ? PALETTE.y : PALETTE.w);
        }
    }

    function outline(x, y, w, h, c) {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, 1);
        ctx.fillRect(x, y + h - 1, w, 1);
        ctx.fillRect(x, y, 1, h);
        ctx.fillRect(x + w - 1, y, 1, h);
    }

    const RAINBOW = ["y", "R", "r", "v", "B", "c", "G"];
    const GLOW = { lucky: () => ["y", "w"], hot: () => ["R", "r"], cosmic: (now) => [0, 3].map((k) => RAINBOW[(Math.floor(now / 70) + k) % RAINBOW.length]) };

    function drawCabinet(now) {
        ctx.fillStyle = PALETTE.r;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = PALETTE.R;
        ctx.fillRect(0, 0, W, 1);
        ctx.fillRect(0, 0, 1, H);
        ctx.fillStyle = PALETTE.p;
        ctx.fillRect(0, H - 1, W, 1);
        ctx.fillRect(W - 1, 0, 1, H);
        const cy = PAD + VIEW_H / 2;
        ctx.fillStyle = PALETTE.y;
        ctx.fillRect(0, cy - 2, 1, 4);
        ctx.fillRect(1, cy - 1, 1, 2);
        ctx.fillRect(W - 1, cy - 2, 1, 4);
        ctx.fillRect(W - 2, cy - 1, 1, 2);
        if (glowMode) {
            const [a, b] = GLOW[glowMode](now);
            const on = Math.floor(now / 90) % 2 === 0;
            outline(0, 0, W, H, PALETTE[on ? a : b]);
            outline(1, 1, W - 2, H - 2, PALETTE[on ? b : a]);
        }
    }

    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(now, dt);
        if (canvas.offsetParent) {
            drawCabinet(now);
            reels.forEach((r, i) => drawReel(r, i, now));
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function stopReel(i, symbol, resolve) {
        const r = reels[i];
        const v = Math.max(r.v, 8);
        let target = Math.ceil(r.pos) + 1;
        if (!r.strip.includes(symbol)) r.strip[mod(target + 2, STRIP_LEN)] = symbol;
        while (r.strip[mod(target, STRIP_LEN)] !== symbol) target++;
        r.from = r.pos;
        r.to = target;
        r.t0 = performance.now();
        r.dur = clamp(((BACK + 3) * (target - r.pos) * 1000) / v, 320, 900);
        r.mode = "stop";
        r.done = resolve;
    }

    return {
        reelCenter(i) {
            const rect = canvas.getBoundingClientRect();
            const scale = rect.width / W;
            return {
                x: rect.left + (PAD + i * (REEL_W + GAP) + REEL_W / 2) * scale,
                y: rect.top + (PAD + VIEW_H / 2) * scale,
            };
        },
        spin() {
            const now = performance.now();
            highlight = { cells: [], until: 0 };
            teaseReel = -1;
            reels.forEach((r, i) => {
                r.mode = "spin";
                r.startAt = now + i * 70;
            });
        },
        stopAt(result, { tease = false, cosmic = false } = {}) {
            const delays = cosmic ? [900, 2200, 3800] : [0, 170, tease ? 1250 : 340];
            if (tease && !cosmic) teaseReel = 2;
            pending = [];
            return Promise.all(
                result.map(
                    (symbol, i) =>
                        new Promise((resolve) => {
                            const fire = () => {
                                pending = pending.filter((p) => p.fire !== fire);
                                stopReel(i, symbol, () => {
                                    if (i === teaseReel) teaseReel = -1;
                                    onReelStop?.(i);
                                    resolve();
                                });
                            };
                            pending.push({ fire, timer: setTimeout(fire, delays[i]) });
                        }),
                ),
            );
        },
        // Skip: stop every reel right away with a short settle.
        rush() {
            teaseReel = -1;
            pending.splice(0).forEach(({ fire, timer }) => {
                clearTimeout(timer);
                fire();
            });
            const now = performance.now();
            reels.forEach((r) => {
                if (r.mode === "stop") r.dur = Math.min(r.dur, now - r.t0 + 160);
            });
        },
        glow(mode) {
            glowMode = mode;
        },
        highlight(cells, ms = 1600) {
            highlight = { cells, until: performance.now() + ms };
        },
    };
}
