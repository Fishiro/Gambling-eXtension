import { PALETTE, drawSprite } from "./sprites.js";

const W = 96;
const H = 40;
const FLOOR = 34;
const MINER = { x: 42, y: FLOOR - 14 };
const SHOULDER = { x: MINER.x + 8, y: MINER.y + 9 };
const ROCK = { x: 62, y: 12, w: 28, h: 22 };
const CART = { x: 5, y: FLOOR - 9 };
const TORCH = { x: 32, y: 10 };
const PET = { x: 31, y: FLOOR - 12, w: 10, h: 12 };
const REST = -60;
// 9 TO 5 skin layout: the typist sits where the miner stands, the boss stands where the cart is.
const DESK = { x: 52, y: FLOOR - 7, w: 42 };
const KEYBOARD = { x: 54, y: DESK.y - 1, w: 9 };
const SCREEN = { x: 67, y: 8, w: 22, h: 15 };
const BOSS = { x: 3, y: FLOOR - 19 };
const POCKET = { x: BOSS.x + 10, y: BOSS.y + 11 };
const STACK = { x: 17, w: 7 };
const CLERK = { x: MINER.x - 1, y: FLOOR - 14 };
const CLERK_SHOULDER = { x: CLERK.x + 8, y: CLERK.y + 8 };
// PLAY ITSELF skin: you slam the machine's button, the owner stands behind you where the boss stood.
const MACHINE = { x: 63, y: 4, w: 28 };
const BUTTON = { x: 59, y: 24 };
const REELS = { x: 67, y: 11, cell: 6, h: 8 };
const REEL_COLORS = ["r", "y", "c", "G", "R", "v"];
// SIX SEVEN skin: a basketball court. Seesaw Kid does the palms-up seesaw, the scoreboard is stuck on 67,
// and SIX and SEVEN ride a real seesaw where the coins pile up.
const KID = { x: MINER.x, y: FLOOR - 14 };
const BOARD = { x: 66, y: 5, w: 24, h: 14 };
const SEESAW = { x: 2, w: 28, pivot: 16, y: FLOOR - 7 };
// 3x5 digits for the little LED / floating numbers.
const GLYPHS = {
    6: ["###", "#..", "###", "#.#", "###"],
    7: ["###", "..#", ".#.", ".#.", ".#."],
};
const LOOKS = {
    miner: { hit: { x: ROCK.x + 1, y: SHOULDER.y + 3 }, drop: { x: CART.x + 5, y: CART.y - 1, spread: 8 }, debris: ["S", "l"], loot: "l", lucky: "y" },
    office: { hit: { x: KEYBOARD.x + 4, y: KEYBOARD.y - 1 }, drop: { x: POCKET.x - 1, y: POCKET.y, spread: 1 }, debris: ["w", "l"], loot: "y", lucky: "G" },
    casino: { hit: { x: BUTTON.x + 1, y: BUTTON.y }, drop: { x: BOSS.x + 9, y: BOSS.y + 10, spread: 2 }, debris: ["y", "w"], loot: "y", lucky: "c" },
    sixseven: { hit: { x: BOARD.x + 2, y: BOARD.y + BOARD.h }, drop: { x: SEESAW.x + SEESAW.pivot - 3, y: SEESAW.y - 3, spread: 5 }, debris: ["R", "w"], loot: "y", lucky: "c" },
};
// Who catches the loot in each skin, and what their pile is made of.
const RECEIVERS = {
    office: { sprite: "boss", pile: ["y", "Y"], glint: { x: POCKET.x, y: POCKET.y - 2, c: "y" } },
    casino: { sprite: "tycoon", pile: ["y", "R", "Y", "P"], glint: { x: BOSS.x + 4, y: BOSS.y + 3, c: "w" } },
};
const GEM_COLORS = ["c", "y", "G", "R", "B"];
const DEG = Math.PI / 180;

function seeded(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function offscreen(w, h, paint) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    paint(ctx);
    return c;
}

const px = (ctx, c, x, y, w = 1, h = 1) => {
    ctx.fillStyle = PALETTE[c] ?? c;
    ctx.fillRect(x, y, w, h);
};

function paintBackground(ctx) {
    const rnd = seeded(7);
    px(ctx, "k", 0, 0, W, H);
    for (let i = 0; i < 90; i++) {
        const x = Math.floor(rnd() * W);
        const y = Math.floor(rnd() * (FLOOR - 4)) + 3;
        const w = 3 + Math.floor(rnd() * 5);
        const h = 2 + Math.floor(rnd() * 3);
        px(ctx, "s", x, y, w, h);
        px(ctx, "S", x, y, Math.ceil(w / 2), 1);
    }
    for (let x = 2; x < W; x += 7 + Math.floor(rnd() * 6)) {
        const len = 2 + Math.floor(rnd() * 4);
        for (let i = 0; i < len; i++) px(ctx, "s", x + Math.floor(i / 2), 3 + i, Math.max(1, 3 - i), 1);
    }

    px(ctx, "o", 30, 4, 2, FLOOR - 4);
    px(ctx, "O", 30, 4, 1, FLOOR - 4);
    px(ctx, "o", 92, 4, 2, FLOOR - 4);
    px(ctx, "O", 92, 4, 1, FLOOR - 4);
    px(ctx, "o", 26, 3, W - 26, 3);
    px(ctx, "O", 26, 3, W - 26, 1);
    for (let x = 28; x < W; x += 9) px(ctx, "k", x, 4, 1, 1);

    px(ctx, "o", TORCH.x + 1, TORCH.y + 5, 1, 4);
    px(ctx, "S", TORCH.x, TORCH.y + 5, 3, 1);

    px(ctx, "o", 0, FLOOR + 1, W, H - FLOOR - 1);
    for (let i = 0; i < 40; i++) px(ctx, rnd() > 0.5 ? "O" : "s", Math.floor(rnd() * W), FLOOR + 2 + Math.floor(rnd() * 4));
    for (let x = 1; x < W; x += 5) px(ctx, "O", x, FLOOR + 1, 2, 1);
    px(ctx, "S", 0, FLOOR, W, 1);
    for (let x = 0; x < W; x += 3) px(ctx, "l", x, FLOOR, 1, 1);
}

function paintOffice(ctx) {
    const rnd = seeded(11);
    px(ctx, "n", 0, 0, W, FLOOR);
    for (let x = 3; x < W; x += 6) px(ctx, "b", x, 0, 1, FLOOR - 6);
    px(ctx, "s", 0, FLOOR - 6, W, 6);
    px(ctx, "S", 0, FLOOR - 6, W, 1);
    // window with a night skyline
    px(ctx, "l", 22, 4, 20, 15);
    px(ctx, "k", 23, 5, 18, 13);
    for (let x = 23; x < 41; x += 3) {
        const h = 3 + Math.floor(rnd() * 8);
        px(ctx, "s", x, 18 - h, 3, h);
        for (let y = 18 - h + 1; y < 17; y += 2) if (rnd() > 0.5) px(ctx, "y", x + 1, y);
    }
    px(ctx, "l", 31, 5, 1, 13);
    // wall clock
    px(ctx, "k", 47, 3, 7, 7);
    px(ctx, "w", 48, 4, 5, 5);
    px(ctx, "k", 50, 5, 1, 2);
    px(ctx, "k", 51, 6, 1, 1);
    // ceiling lamp
    px(ctx, "S", 30, 0, 16, 1);
    px(ctx, "w", 31, 1, 14, 1);
    // floor + desk
    px(ctx, "s", 0, FLOOR + 1, W, H - FLOOR - 1);
    for (let i = 0; i < 40; i++) px(ctx, "S", Math.floor(rnd() * W), FLOOR + 2 + Math.floor(rnd() * 4));
    px(ctx, "k", 0, FLOOR, W, 1);
    px(ctx, "O", DESK.x, DESK.y, DESK.w, 2);
    px(ctx, "y", DESK.x, DESK.y, DESK.w, 1);
    px(ctx, "o", DESK.x + 1, DESK.y + 2, 2, FLOOR - DESK.y - 2);
    px(ctx, "o", DESK.x + DESK.w - 3, DESK.y + 2, 2, FLOOR - DESK.y - 2);
    // monitor stand + coffee mug
    px(ctx, "S", SCREEN.x + 9, SCREEN.y + SCREEN.h, 4, DESK.y - SCREEN.y - SCREEN.h);
    px(ctx, "s", SCREEN.x + 6, DESK.y - 1, 10, 1);
    px(ctx, "w", 64, DESK.y - 3, 3, 3);
    px(ctx, "O", 64, DESK.y - 3, 3, 1);
    px(ctx, "w", 67, DESK.y - 2);
}

function paintCasino(ctx) {
    const rnd = seeded(23);
    px(ctx, "p", 0, 0, W, FLOOR);
    for (let y = 4; y < FLOOR - 6; y += 6) {
        for (let x = (y / 6) % 2 ? 0 : 4; x < W; x += 8) {
            px(ctx, "r", x + 1, y, 1, 1);
            px(ctx, "r", x, y + 1, 3, 1);
            px(ctx, "r", x + 1, y + 2, 1, 1);
        }
    }
    px(ctx, "r", 0, FLOOR - 6, W, 6);
    px(ctx, "Y", 0, FLOOR - 6, W, 1);
    // a dim row of other machines far back
    for (const x of [20, 30, 40]) {
        px(ctx, "k", x, 12, 8, FLOOR - 12);
        px(ctx, "s", x + 1, 13, 6, 4);
        px(ctx, "p", x + 1, 18, 6, FLOOR - 19);
    }
    // carpet
    px(ctx, "r", 0, FLOOR + 1, W, H - FLOOR - 1);
    for (let i = 0; i < 50; i++) px(ctx, rnd() > 0.5 ? "y" : "p", Math.floor(rnd() * W), FLOOR + 2 + Math.floor(rnd() * 4));
    px(ctx, "Y", 0, FLOOR, W, 1);
}

function glyph(ctx, digit, x, y, c, scale = 1) {
    GLYPHS[digit].forEach((row, dy) => [...row].forEach((ch, dx) => ch === "#" && px(ctx, c, x + dx * scale, y + dy * scale, scale, scale)));
}

function paintSixSeven(ctx) {
    // night court: black wall, neon orange stripe, a giant chromatic-glitch 67
    px(ctx, "k", 0, 0, W, FLOOR);
    px(ctx, "o", 0, 2, W, 1);
    for (const [dx, c] of [[-1, "t"], [1, "p"], [0, "s"]]) {
        glyph(ctx, 6, 24 + dx, 4, c, 3);
        glyph(ctx, 7, 37 + dx, 4, c, 3);
    }
    // hoop on the back wall
    px(ctx, "w", 50, 4, 10, 7);
    px(ctx, "R", 53, 6, 4, 3);
    px(ctx, "k", 54, 7, 2, 1);
    px(ctx, "R", 52, 11, 6, 1);
    for (let i = 0; i < 3; i++) px(ctx, "l", 53 + i * 2, 12 + (i % 2), 1, 3);
    // scoreboard pole
    px(ctx, "S", BOARD.x + BOARD.w / 2 - 1, BOARD.y + BOARD.h, 2, FLOOR - BOARD.y - BOARD.h);
    // hardwood floor with a court line
    px(ctx, "O", 0, FLOOR + 1, W, H - FLOOR - 1);
    for (let x = 0; x < W; x += 8) px(ctx, "o", x, FLOOR + 1, 1, H - FLOOR - 1);
    px(ctx, "w", 0, FLOOR + 3, W, 1);
    px(ctx, "y", 0, FLOOR, W, 1);
    // mango + mustard on the sideline (don't ask)
    px(ctx, "k", 57, FLOOR - 5, 6, 5);
    px(ctx, "R", 58, FLOOR - 4, 4, 4);
    px(ctx, "y", 58, FLOOR - 4, 2, 2);
    px(ctx, "G", 60, FLOOR - 6, 1, 1);
    px(ctx, "k", 63, FLOOR - 8, 4, 8);
    px(ctx, "y", 64, FLOOR - 7, 2, 7);
    px(ctx, "r", 64, FLOOR - 9, 2, 1);
}

function paintRock(ctx, gems) {
    const rnd = seeded(42);
    const { w, h } = ROCK;
    const inside = (x, y) => {
        const dx = (x - w / 2 + 0.5) / (w / 2);
        const dy = (y - h + 0.5) / h;
        const wobble = Math.sin(x * 1.7) * 0.06 + Math.cos(y * 2.3) * 0.05;
        return dx * dx + dy * dy <= 1 + wobble && y < h;
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!inside(x, y)) continue;
            const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1);
            if (edge) {
                px(ctx, "k", x, y);
                continue;
            }
            const light = !inside(x - 2, y - 1) || !inside(x - 1, y - 2);
            const shadow = !inside(x + 2, y + 1) || x > w * 0.72 || y > h - 3;
            px(ctx, light ? "l" : shadow ? "s" : rnd() > 0.85 ? "s" : "S", x, y);
        }
    }
    for (let i = 0; i < 16; i++) {
        const x = 3 + Math.floor(rnd() * (w - 6));
        const y = 4 + Math.floor(rnd() * (h - 7));
        if (!inside(x - 1, y - 1) || !inside(x + 2, y + 2)) continue;
        const c = GEM_COLORS[Math.floor(rnd() * GEM_COLORS.length)];
        px(ctx, "k", x - 1, y + 1, 3, 1);
        px(ctx, c, x, y, 2, 1);
        px(ctx, c, x, y + 1);
        px(ctx, "w", x, y);
        gems.push({ x, y, c });
    }
}

function recolor(src, map) {
    const out = offscreen(src.width, src.height, (ctx) => ctx.drawImage(src, 0, 0));
    const ctx = out.getContext("2d");
    const img = ctx.getImageData(0, 0, out.width, out.height);
    const lookup = Object.fromEntries(Object.entries(map).map(([from, to]) => [PALETTE[from].slice(1), PALETTE[to]]));
    for (let i = 0; i < img.data.length; i += 4) {
        const key = [0, 1, 2].map((j) => img.data[i + j].toString(16).padStart(2, "0")).join("");
        const to = lookup[key];
        if (!to) continue;
        img.data[i] = parseInt(to.slice(1, 3), 16);
        img.data[i + 1] = parseInt(to.slice(3, 5), 16);
        img.data[i + 2] = parseInt(to.slice(5, 7), 16);
    }
    ctx.putImageData(img, 0, 0);
    return out;
}

function line(ctx, x0, y0, x1, y1, c) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        px(ctx, c, x, y);
        if (x === tx && y === ty) return;
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y += sy;
        }
    }
}

const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) ** 2;
const easeIn = (t) => t * t;

function swingAngle(t) {
    if (t < 0.4) return lerp(REST, -150, easeOut(t / 0.4));
    if (t < 0.55) return lerp(-150, 22, easeIn((t - 0.4) / 0.15));
    if (t < 0.7) return 22 - Math.sin(((t - 0.55) / 0.15) * Math.PI) * 6;
    return lerp(22, REST, easeOut((t - 0.7) / 0.3));
}

export function createMineScene(canvas, { getFill, getAutoPeriod, isGoldRush, getPet, getSkin = () => "miner", onImpact }) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const gems = [];
    const background = offscreen(W, H, paintBackground);
    const office = offscreen(W, H, paintOffice);
    const casino = offscreen(W, H, paintCasino);
    const sixseven = offscreen(W, H, paintSixSeven);
    let shoutUntil = 0;
    let glitchUntil = 0;
    let jackpotUntil = 0;
    let bossHappyUntil = 0;
    const rock = offscreen(ROCK.w, ROCK.h, (c) => paintRock(c, gems));
    const goldRock = recolor(rock, { S: "Y", l: "y", s: "O" });
    let bat = null;
    let petJump = null;
    const pileSeed = seeded(3);
    const pileColors = Array.from({ length: 64 }, () => (pileSeed() > 0.88 ? GEM_COLORS[Math.floor(pileSeed() * 5)] : pileSeed() > 0.5 ? "S" : "l"));
    const bits = [];
    let swing = null;
    let nextAuto = performance.now() + 1200;
    let rockShakeUntil = 0;
    let last = performance.now();

    const toPage = (x, y) => {
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + (x / W) * rect.width, y: rect.top + (y / H) * rect.height };
    };

    function impact(s) {
        rockShakeUntil = performance.now() + 140;
        const look = LOOKS[getSkin()] ?? LOOKS.miner;
        const hx = look.hit.x;
        const hy = look.hit.y;
        for (let i = 0; i < (s.lucky ? 14 : 6); i++) {
            bits.push({
                x: hx,
                y: hy,
                vx: -10 - Math.random() * 30,
                vy: -30 - Math.random() * 50,
                c: s.lucky && i % 2 ? GEM_COLORS[i % GEM_COLORS.length] : look.debris[i % 2],
                life: 0.6 + Math.random() * 0.4,
            });
        }
        if (s.lucky) jackpotUntil = performance.now() + 700;
        if (s.user) shoutUntil = performance.now() + 260;
        if (s.user) {
            const count = Math.min(5, 1 + Math.floor(s.power / 2));
            bossHappyUntil = performance.now() + 900;
            for (let i = 0; i < count; i++) {
                const t = 0.55 + i * 0.06;
                const tx = look.drop.x + Math.random() * look.drop.spread;
                const ty = look.drop.y;
                const g = 220;
                bits.push({
                    x: hx,
                    y: hy,
                    vx: (tx - hx) / t,
                    vy: (ty - hy - (g * t * t) / 2) / t,
                    g,
                    c: s.lucky ? look.lucky : look.loot,
                    size: 2,
                    life: t,
                });
            }
        }
        s.onHit?.(toPage(hx, hy));
        onImpact?.(toPage(hx, hy), s);
    }

    const swingT = (now) => (swing ? Math.min(1, (now - swing.t0) / swing.dur) : 0);

    function settleSwing(t) {
        if (swing && !swing.hit && t >= 0.55) {
            swing.hit = true;
            impact(swing);
        }
        if (swing && t >= 1) swing = null;
    }

    function drawMiner(now) {
        const t = swingT(now);
        const angle = (swing ? swingAngle(t) : REST + Math.sin(now / 500) * 3) * DEG;
        const bob = !swing && Math.floor(now / 600) % 2 ? 1 : 0;
        drawSprite(ctx, "miner", MINER.x, MINER.y + bob);

        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const normal = { x: -dir.y, y: dir.x };
        const sx = SHOULDER.x;
        const sy = SHOULDER.y + bob;
        const hand = { x: sx + dir.x * 3, y: sy + dir.y * 3 };
        const tip = { x: hand.x + dir.x * 8, y: hand.y + dir.y * 8 };
        line(ctx, sx, sy, hand.x, hand.y, "B");
        line(ctx, hand.x, hand.y, tip.x, tip.y, "O");
        const back = { x: tip.x - dir.x, y: tip.y - dir.y };
        line(ctx, back.x - normal.x * 3, back.y - normal.y * 3, tip.x, tip.y, "l");
        line(ctx, tip.x, tip.y, back.x + normal.x * 3, back.y + normal.y * 3, "l");
        px(ctx, "w", Math.round(back.x + normal.x * 3), Math.round(back.y + normal.y * 3));
        px(ctx, "f", Math.round(hand.x), Math.round(hand.y));
        settleSwing(t);
    }

    // ---- 9 TO 5 skin ----

    // Two hands hammer the keyboard in turn: idle is lazy typing, a tap is a frantic burst.
    function drawClerk(now) {
        const t = swingT(now);
        const beat = swing ? Math.floor(t * 8) : Math.floor(now / 260);
        const bob = swing ? 0 : Math.floor(now / 700) % 2;
        drawSprite(ctx, "clerk", CLERK.x, CLERK.y + bob);
        const hands = [
            { x: KEYBOARD.x + 2, down: beat % 2 === 0, c: "w" },
            { x: KEYBOARD.x + 6, down: beat % 2 === 1, c: "l" },
        ];
        for (const h of hands) {
            const hy = KEYBOARD.y - (h.down ? 1 : 3);
            line(ctx, CLERK_SHOULDER.x, CLERK_SHOULDER.y + bob, h.x, hy, h.c);
            px(ctx, "f", h.x, hy, 2, 1);
            if (h.down && (swing || beat % 4 < 2)) px(ctx, "w", h.x, KEYBOARD.y);
        }
        settleSwing(t);
    }

    function drawDesk(now) {
        const shake = now < rockShakeUntil ? (Math.floor(now / 30) % 2 ? 1 : -1) : 0;
        const rush = isGoldRush();
        const { x, y, w, h } = SCREEN;
        px(ctx, "k", x - 1 + shake, y - 1, w + 2, h + 2);
        px(ctx, "S", x + shake, y, w, h);
        px(ctx, rush ? "o" : "k", x + 1 + shake, y + 1, w - 2, h - 2);
        const scroll = Math.floor(now / 140);
        for (let row = 0; row < 5; row++) {
            const len = 4 + ((row * 7 + scroll * 3) % 12);
            px(ctx, rush ? "y" : row % 3 ? "G" : "c", x + 3 + shake, y + 3 + row * 2, len, 1);
        }
        px(ctx, "S", KEYBOARD.x, KEYBOARD.y, KEYBOARD.w, 1);
        for (let k = 0; k < KEYBOARD.w; k += 2) px(ctx, "l", KEYBOARD.x + k, KEYBOARD.y);
    }

    // The boss's pile grows with the cart; coins land in the pocket and the boss bounces.
    // The boss / owner: their pile grows with the cart, and they bounce when coins land.
    function drawReceiver(now, { sprite, pile, glint }) {
        const fill = getFill();
        const happy = now < bossHappyUntil;
        const bob = happy ? Math.floor(now / 90) % 2 : Math.floor(now / 900) % 2;
        const height = Math.round(fill * 9);
        for (let j = 0; j < height; j++) {
            px(ctx, pile[j % pile.length], STACK.x + (j % 3 === 2 ? 1 : 0), FLOOR - 1 - j, STACK.w - 1, 1);
            px(ctx, "k", STACK.x - 1, FLOOR - 1 - j);
        }
        drawSprite(ctx, sprite, BOSS.x, BOSS.y - bob);
        if (happy && Math.floor(now / 120) % 2) px(ctx, glint.c, glint.x, glint.y - bob, 2, 1);
        if (fill >= 1 && Math.floor(now / 350) % 2 === 0) drawSprite(ctx, "alert", BOSS.x + 3, BOSS.y - 12);
    }

    // ---- PLAY ITSELF skin ----

    // You: a slap on the button when idle, a full headbutt when you spam.
    function drawGambler(now) {
        const t = swingT(now);
        const reach = swing && t > 0.35 && t < 0.7;
        const dash = swing?.user ? Math.round(Math.sin(Math.min(1, Math.max(0, (t - 0.3) / 0.4)) * Math.PI) * 4) : 0;
        const bob = swing ? 0 : Math.floor(now / 600) % 2;
        const x = MINER.x + dash;
        drawSprite(ctx, "gambler", x, MINER.y + bob);
        const sx = x + 8;
        const sy = MINER.y + 8 + bob;
        const hand = reach ? { x: BUTTON.x - 1, y: BUTTON.y } : { x: sx + 1, y: sy + 1 };
        line(ctx, sx, sy, hand.x, hand.y, "B");
        px(ctx, "f", hand.x, hand.y, 2, 2);
        if (dash >= 3 && Math.floor(now / 60) % 2) {
            px(ctx, "y", x + 9, MINER.y - 2);
            px(ctx, "w", x + 11, MINER.y);
        }
        settleSwing(t);
    }

    function drawMachine(now) {
        const shake = now < rockShakeUntil ? (Math.floor(now / 30) % 2 ? 1 : -1) : 0;
        const rush = isGoldRush();
        const x = MACHINE.x + shake;
        const body = rush ? "Y" : "r";
        px(ctx, "k", x - 1, MACHINE.y - 1, MACHINE.w + 2, FLOOR - MACHINE.y + 1);
        px(ctx, body, x, MACHINE.y, MACHINE.w, FLOOR - MACHINE.y);
        px(ctx, rush ? "y" : "R", x, MACHINE.y, 1, FLOOR - MACHINE.y);
        // marquee lights chase along the top
        px(ctx, "y", x + 1, MACHINE.y + 1, MACHINE.w - 2, 4);
        for (let i = 0; i < MACHINE.w - 2; i += 3) if ((i / 3 + Math.floor(now / 150)) % 2) px(ctx, "w", x + 1 + i, MACHINE.y + 2, 1, 2);
        // reels: spin while you hit, flash 7-7-7 on a lucky hit
        px(ctx, "k", REELS.x - 1 + shake, REELS.y - 1, REELS.cell * 3 + 4, REELS.h + 2);
        const spinning = now < rockShakeUntil + 400;
        for (let i = 0; i < 3; i++) {
            const rx = REELS.x + shake + i * (REELS.cell + 1);
            px(ctx, "w", rx, REELS.y, REELS.cell, REELS.h);
            const sym = now < jackpotUntil ? "y" : REEL_COLORS[(spinning ? Math.floor(now / 50) + i * 2 : i * 3 + 1) % REEL_COLORS.length];
            const sy = REELS.y + 2 + (spinning ? Math.floor(now / 25 + i) % 2 : 0);
            px(ctx, sym, rx + 1, sy, REELS.cell - 2, 4);
        }
        // coin tray + the big red button you keep slamming
        px(ctx, "s", x + 3, FLOOR - 7, MACHINE.w - 6, 3);
        px(ctx, "Y", x + 4, FLOOR - 6, MACHINE.w - 8, 1);
        const pressed = now < rockShakeUntil;
        px(ctx, "k", BUTTON.x - 1, BUTTON.y - 2, 5, 5);
        px(ctx, pressed ? "r" : "R", BUTTON.x + (pressed ? 1 : 0), BUTTON.y - 1, 3, 3);
        if (!pressed) px(ctx, "w", BUTTON.x, BUTTON.y - 1);
    }

    // ---- SIX SEVEN skin ----

    // The palms-up seesaw: one hand up, one hand down, a little 6 and 7 floating over them.
    // Every tap he screams it: a speech bubble with 67 pops for a moment.
    function drawKid(now) {
        const t = swingT(now);
        const beat = swing ? Math.floor(t * 6) : Math.floor(now / 420);
        drawSprite(ctx, "kid", KID.x, KID.y + (swing ? 0 : beat % 2));
        const hands = [
            { sx: KID.x + 2, x: KID.x - 3, up: beat % 2 === 0, digit: 6, c: "c" },
            { sx: KID.x + 9, x: KID.x + 12, up: beat % 2 === 1, digit: 7, c: "R" },
        ];
        for (const h of hands) {
            const hy = KID.y + 9 + (h.up ? -3 : 2);
            line(ctx, h.sx, KID.y + 9, h.x + 1, hy, "R");
            px(ctx, "f", h.x, hy, 3, 1);
            glyph(ctx, h.digit, h.x, hy - 7, h.c);
        }
        if (now < shoutUntil) {
            const bx = KID.x + 7;
            const by = KID.y - 9;
            px(ctx, "k", bx - 1, by - 1, 12, 9);
            px(ctx, "w", bx, by, 10, 7);
            px(ctx, "w", bx + 1, by + 7, 2, 2);
            glyph(ctx, 6, bx + 1, by + 1, "R");
            glyph(ctx, 7, bx + 5, by + 1, "R");
            px(ctx, "r", bx + 9, by + 1, 1, 3);
            px(ctx, "r", bx + 9, by + 5, 1, 1);
        }
        settleSwing(t);
    }

    // The scoreboard only ever shows 67. A hit makes it flash red/white like a bass-boosted impact frame.
    function drawScoreboard(now) {
        const hit = now < rockShakeUntil;
        const shake = hit ? (Math.floor(now / 30) % 2 ? 1 : -1) : 0;
        const { x, y, w, h } = BOARD;
        px(ctx, "S", x - 1 + shake, y - 1, w + 2, h + 2);
        px(ctx, hit && Math.floor(now / 50) % 2 ? "w" : "k", x + shake, y, w, h);
        const c = hit ? "r" : isGoldRush() ? "y" : "R";
        glyph(ctx, 6, x + 4 + shake, y + 2, c, 2);
        glyph(ctx, 7, x + 13 + shake, y + 2, c, 2);
        if (Math.floor(now / 600) % 2) px(ctx, "G", x + w - 2 + shake, y + 1, 1, 1);
    }

    // A real seesaw: SIX on one end, SEVEN on the other, tipping back and forth. Coins pile over the pivot.
    function drawSeesaw(now) {
        const fill = getFill();
        const happy = now < bossHappyUntil;
        const tip = Math.floor(now / (happy ? 140 : 520)) % 2 ? 2 : -2;
        const { x, w, pivot, y } = SEESAW;
        const left = y + tip;
        const right = y - tip;
        // pivot block
        px(ctx, "k", x + pivot - 3, y, 6, FLOOR - y);
        px(ctx, "S", x + pivot - 2, y + 1, 4, FLOOR - y - 1);
        // plank
        line(ctx, x, left, x + w, right, "O");
        line(ctx, x, left + 1, x + w, right + 1, "o");
        // the pile sits on the pivot
        const height = Math.round(fill * 8);
        for (let j = 0; j < height; j++) px(ctx, j % 2 ? "Y" : "y", x + pivot - 3 + (j % 3 === 2 ? 1 : 0), y - 1 - j, 5, 1);
        drawSprite(ctx, "digit6", x, left - 12);
        drawSprite(ctx, "digit7", x + w - 10, right - 12);
        if (fill >= 1 && Math.floor(now / 350) % 2 === 0) drawSprite(ctx, "alert", x + pivot - 3, y - 22);
    }

    // The big moment: horizontal glitch slices and a red wash over the whole scene.
    function drawGlitch(now) {
        if (now >= glitchUntil) return;
        for (let i = 0; i < 4; i++) {
            const sy = Math.floor(Math.random() * H);
            const sh = 2 + Math.floor(Math.random() * 5);
            ctx.drawImage(canvas, 0, sy, W, sh, Math.round((Math.random() - 0.5) * 8), sy, W, sh);
        }
        ctx.fillStyle = Math.floor(now / 60) % 2 ? "rgba(239, 125, 87, 0.25)" : "rgba(244, 244, 244, 0.18)";
        ctx.fillRect(0, 0, W, H);
    }

    // Neon sign over the floor: SLOTS in pink, blinking.
    function drawNeon(now) {
        const on = Math.floor(now / 500) % 4 !== 3;
        const c = on ? "P" : "p";
        px(ctx, c, 20, 3, 28, 1);
        px(ctx, c, 20, 8, 28, 1);
        px(ctx, c, 20, 3, 1, 6);
        px(ctx, c, 47, 3, 1, 6);
        for (let i = 0; i < 3; i++) px(ctx, on ? "y" : "O", 25 + i * 7, 5, 4, 2);
    }

    function drawLamp(now) {
        const flicker = Math.random() > 0.995 ? 0.02 : 0.06;
        ctx.fillStyle = `rgba(244, 244, 244, ${flicker})`;
        for (let y = 2; y < FLOOR; y++) {
            const half = 7 + Math.round(y * 0.6);
            ctx.fillRect(38 - half, y, half * 2, 1);
        }
    }

    function drawCart(now) {
        const fill = getFill();
        const cart = { x: CART.x, y: CART.y };
        for (let c = 0; c < 16; c++) {
            const curve = 1 - ((c - 7.5) / 8.5) ** 2;
            const h = Math.round(fill * 7 * curve);
            for (let j = 0; j < h; j++) px(ctx, pileColors[(c * 7 + j * 3) % pileColors.length], cart.x + 1 + c, cart.y - 1 - j);
        }
        drawSprite(ctx, "cart", cart.x, cart.y);
        if (fill >= 1 && Math.floor(now / 350) % 2 === 0) drawSprite(ctx, "alert", cart.x + 8, cart.y - 15);
    }

    function drawLight(now) {
        const flicker = 1 + Math.sin(now / 90) * 0.15 + Math.random() * 0.1;
        for (const [radius, alpha] of [[13, 0.05], [9, 0.07], [5, 0.1]]) {
            ctx.fillStyle = `rgba(239, 125, 87, ${alpha * flicker})`;
            for (let y = -radius; y <= radius; y++) {
                const half = Math.round(Math.sqrt(radius * radius - y * y) * 1.2);
                ctx.fillRect(TORCH.x + 1 - half, TORCH.y + 2 + y, half * 2 + 1, 1);
            }
        }
        drawSprite(ctx, `flame${Math.floor(now / 120) % 3}`, TORCH.x, TORCH.y);
    }

    function drawRock(now) {
        const shake = now < rockShakeUntil ? (Math.floor(now / 30) % 2 ? 1 : -1) : 0;
        const rush = isGoldRush();
        ctx.drawImage(rush ? goldRock : rock, ROCK.x + shake, ROCK.y);
        if (rush) {
            for (let i = 0; i < 3; i++) {
                px(ctx, "w", ROCK.x + 3 + Math.floor(Math.random() * (ROCK.w - 6)), ROCK.y + 3 + Math.floor(Math.random() * (ROCK.h - 4)));
            }
        }
        const g = gems[Math.floor(now / 260) % gems.length];
        if (g && Math.floor(now / 130) % 2 === 0) {
            px(ctx, "w", ROCK.x + shake + g.x - 1, ROCK.y + g.y);
            px(ctx, "w", ROCK.x + shake + g.x + 2, ROCK.y + g.y);
            px(ctx, "w", ROCK.x + shake + g.x, ROCK.y + g.y - 1);
        }
    }

    function batPosition(now) {
        const p = (now - bat.t0) / bat.dur;
        return { p, x: lerp(W + 4, -14, p), y: 9 + Math.sin(p * 14) * 4 };
    }

    function drawBat(now) {
        if (!bat) return;
        const { p, x, y } = batPosition(now);
        if (p >= 1) {
            bat = null;
            return;
        }
        if (Math.floor(now / 140) % 2) px(ctx, "y", Math.round(x + 4 + Math.random() * 6), Math.round(y + 6));
        drawSprite(ctx, `bat${Math.floor(now / 120) % 2}`, x, y);
    }

    function petY(now) {
        if (petJump) {
            const t = (now - petJump.t0) / petJump.dur;
            if (t >= 1) petJump = null;
            else return PET.y - Math.sin(t * Math.PI) * petJump.height;
        }
        return PET.y + (Math.floor(now / 450) % 2 ? 1 : 0);
    }

    function drawPet(now) {
        const pet = getPet();
        if (!pet) return;
        if (pet === "cat") return drawNappingCat(now);
        const flip = Math.floor(now / 2400) % 3 === 0;
        drawSprite(ctx, pet, PET.x, petY(now), flip);
    }

    // Meemee never turns around or bobs: slow breathing and a "z" drifting up now and then.
    function drawNappingCat(now) {
        const y = petJump ? petY(now) : PET.y + (Math.floor(now / 1600) % 2);
        drawSprite(ctx, "cat", PET.x - 1, y);
        const t = (now % 3200) / 3200;
        if (t < 0.6 || petJump) return;
        const k = (t - 0.6) / 0.4;
        const zx = PET.x + 3 + Math.round(k * 4);
        const zy = PET.y + 1 - Math.round(k * 8);
        for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]) px(ctx, "w", zx + dx, zy + dy);
    }

    function drawBits(dt) {
        for (let i = bits.length - 1; i >= 0; i--) {
            const b = bits[i];
            b.life -= dt;
            if (b.life <= 0) {
                bits.splice(i, 1);
                continue;
            }
            b.vy += (b.g ?? 160) * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (!b.g && b.y > FLOOR - 1) {
                b.y = FLOOR - 1;
                b.vy *= -0.4;
                b.vx *= 0.6;
            }
            px(ctx, b.c, Math.round(b.x), Math.round(b.y), b.size ?? 1, b.size ?? 1);
        }
    }

    // Each skin: a painted background plus its layers, back to front.
    const SCENES = {
        miner: { bg: background, layers: [drawLight, drawRock, drawCart, drawPet, drawMiner] },
        office: { bg: office, layers: [drawLamp, drawDesk, (now) => drawReceiver(now, RECEIVERS.office), drawPet, drawClerk] },
        casino: { bg: casino, layers: [drawNeon, drawMachine, (now) => drawReceiver(now, RECEIVERS.casino), drawPet, drawGambler] },
        // SIX and SEVEN already stand on stage, so a digit pet doesn't follow you twice.
        sixseven: { bg: sixseven, layers: [drawScoreboard, drawSeesaw, (now) => !getPet()?.startsWith("digit") && drawPet(now), drawKid, drawGlitch] },
    };

    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!swing && now >= nextAuto) {
            if (getFill() < 1) swing = { t0: now, dur: 900, auto: true };
            nextAuto = now + getAutoPeriod() * 1000;
        }
        if (canvas.offsetParent) {
            const scene = SCENES[getSkin()] ?? SCENES.miner;
            ctx.drawImage(scene.bg, 0, 0);
            scene.layers.forEach((draw) => draw(now));
            drawBat(now);
            drawBits(dt);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
        spawnBat(seconds) {
            bat = { t0: performance.now(), dur: seconds * 1000 };
        },
        catchBat(clientX, clientY) {
            if (!bat) return null;
            const rect = canvas.getBoundingClientRect();
            const lx = ((clientX - rect.left) / rect.width) * W;
            const ly = ((clientY - rect.top) / rect.height) * H;
            const { x, y } = batPosition(performance.now());
            if (lx < x - 5 || lx > x + 14 || ly < y - 6 || ly > y + 11) return null;
            bat = null;
            return toPage(x + 4, y + 2);
        },
        hasBat: () => !!bat,
        petCatch() {
            if (!bat || !getPet()) return null;
            const { x, y } = batPosition(performance.now());
            bat = null;
            petJump = { t0: performance.now(), dur: 520, height: 12 };
            return toPage(x + 4, y + 2);
        },
        hitPet(clientX, clientY) {
            if (!getPet()) return null;
            const rect = canvas.getBoundingClientRect();
            const lx = ((clientX - rect.left) / rect.width) * W;
            const ly = ((clientY - rect.top) / rect.height) * H;
            if (lx < PET.x || lx > PET.x + PET.w || ly < PET.y - 1 || ly > PET.y + PET.h) return null;
            petJump ??= { t0: performance.now(), dur: 260, height: 3 };
            return toPage(PET.x + PET.w / 2, PET.y);
        },
        // SIX SEVEN's big moment.
        glitch(ms = 600) {
            glitchUntil = performance.now() + ms;
        },
        swing(info) {
            const now = performance.now();
            if (swing && !swing.hit) impact(swing);
            swing = { ...info, user: true, t0: now - 0.3 * 340, dur: 340, hit: false };
            nextAuto = now + getAutoPeriod() * 1000;
        },
    };
}
