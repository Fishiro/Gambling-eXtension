import { PALETTE } from "./sprites.js";
import { gradeAt } from "./economy.js";

const W = 72;
const H = 6;
const TRACK = W - 4;

const triangle = (u) => 1 - Math.abs((u % 2) - 1);

export function createMeter(canvas) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    let spec = null;
    let t0 = 0;
    let frozen = null;
    let grade = null;
    let flashUntil = 0;
    let active = false;

    const position = (now) => triangle(((now - t0) / 1000) * spec.speed);
    const toX = (p) => 2 + Math.round(p * (TRACK - 2));

    function draw(now) {
        ctx.fillStyle = PALETTE.k;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = PALETTE.s;
        ctx.fillRect(1, 1, W - 2, H - 2);
        for (let x = 4; x < W - 2; x += 4) {
            ctx.fillStyle = PALETTE.n;
            ctx.fillRect(x, H - 2, 1, 1);
        }
        if (!spec) {
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = PALETTE.g;
            ctx.fillRect(toX(0.38), 1, toX(0.62) - toX(0.38), H - 2);
            ctx.fillStyle = PALETTE.y;
            ctx.fillRect(toX(0.47), 1, toX(0.53) - toX(0.47), H - 2);
            ctx.globalAlpha = 1;
            return;
        }

        const flashing = now < flashUntil && Math.floor(now / 80) % 2 === 0;
        const zx = toX(spec.center - spec.width / 2);
        const zw = Math.max(2, toX(spec.center + spec.width / 2) - zx);
        const px = toX(spec.center - spec.perfect / 2);
        const pw = Math.max(1, toX(spec.center + spec.perfect / 2) - px);
        const dim = !active && frozen === null;
        ctx.globalAlpha = dim ? 0.35 : 1;
        ctx.fillStyle = flashing && grade !== "miss" ? PALETTE.w : PALETTE.g;
        ctx.fillRect(zx, 1, zw, H - 2);
        ctx.fillStyle = flashing && grade === "perfect" ? PALETTE.w : PALETTE.y;
        ctx.fillRect(px, 1, pw, H - 2);
        ctx.globalAlpha = 1;

        if (dim) return;
        const p = frozen ?? position(now);
        const cx = toX(p);
        ctx.fillStyle = PALETTE.k;
        ctx.fillRect(cx - 2, 0, 5, H);
        ctx.fillStyle = grade === "miss" ? PALETTE.r : PALETTE.w;
        ctx.fillRect(cx - 1, 0, 3, H);
    }

    function frame(now) {
        if (canvas.offsetParent) draw(now);
        if (active || now < flashUntil + 200) requestAnimationFrame(frame);
    }

    draw(performance.now());

    return {
        start(nextSpec) {
            spec = nextSpec;
            t0 = performance.now();
            frozen = null;
            grade = null;
            active = true;
            requestAnimationFrame(frame);
        },
        stop(forceMiss = false) {
            const now = performance.now();
            frozen = position(now);
            grade = forceMiss ? "miss" : gradeAt(spec, frozen);
            active = false;
            flashUntil = now + 520;
            requestAnimationFrame(frame);
            return grade;
        },
        cursorPoint() {
            const rect = canvas.getBoundingClientRect();
            const p = frozen ?? 0.5;
            return { x: rect.left + (toX(p) / W) * rect.width, y: rect.top + rect.height / 2 };
        },
    };
}
