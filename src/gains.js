import { state } from "./store.js";
import * as econ from "./economy.js";
import * as fx from "./fx.js";
import { toast } from "./toast.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

// "+N" badges that pop out around the HUD counters (coins, diamonds, XP): each gain lands at a random spot
// near its widget with a random tilt, bursts, then floats off. Gains are read off the state itself, so every
// source counts without telling anyone. A gain right after another of its kind adds into that badge instead.

const LIFE_MS = 1400;
const MERGE_MS = 300;
const MAX_ALIVE = 4;
// Per kind: the widget, how far around it badges may land, its spark colors, and when a gain counts as big.
const KINDS = {
    coin: { el: () => $("coins"), spread: [70, 14], colors: ["y", "Y", "w"], big: 1000 },
    gem: { el: () => $("gems"), spread: [24, 12], colors: ["c", "B", "w"], big: 2 },
    xp: { el: () => $("xp-text").parentElement, spread: [90, 10], colors: ["c", "B", "w"], big: 100 },
};

const layer = document.createElement("div");
layer.className = "gains";
document.body.append(layer);

// Every XP point ever earned: the levels already cleared plus the current bar.
function totalXp() {
    let sum = state.xp;
    for (let lv = 1; lv < state.level; lv++) sum += econ.xpToNext(lv);
    return sum;
}

const short = (n) => (n < 10 && n % 1 ? n.toFixed(1) : econ.formatNumber(n));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

function spawner(kind, format) {
    const cfg = KINDS[kind];
    let last = null;
    return (n) => {
        const now = performance.now();
        if (last && now - last.at < MERGE_MS && last.el.isConnected) {
            last.total += n;
            last.at = now;
            last.el.textContent = format(last.total);
            last.el.classList.toggle("is-big", last.total >= cfg.big);
            return;
        }
        const r = cfg.el().getBoundingClientRect();
        const x = r.left + r.width / 2 + rand(-cfg.spread[0], cfg.spread[0]);
        const y = r.top + r.height / 2 + rand(-cfg.spread[1], cfg.spread[1]);
        const el = document.createElement("span");
        el.className = "gain";
        el.dataset.kind = kind;
        el.textContent = format(n);
        el.classList.toggle("is-big", n >= cfg.big);
        el.style.left = `${Math.round(Math.min(window.innerWidth - 40, Math.max(40, x)))}px`;
        el.style.top = `${Math.round(y)}px`;
        el.style.setProperty("--tilt", `${Math.round(rand(-14, 14))}deg`);
        layer.append(el);
        [...layer.querySelectorAll(`[data-kind="${kind}"]`)].slice(0, -MAX_ALIVE).forEach((old) => old.remove());
        fx.burst(x, y, { count: n >= cfg.big ? 16 : 8, colors: cfg.colors, speed: [1, n >= cfg.big ? 3.5 : 2.2], life: [12, 24], gravity: 0.05 });
        setTimeout(() => el.remove(), LIFE_MS);
        last = { el, total: n, at: now };
    };
}

export function createGains() {
    const show = {
        coins: spawner("coin", (n) => `+${short(n)}`),
        gems: spawner("gem", (n) => `+${short(n)}`),
        xp: spawner("xp", (n) => `+${short(n)} XP`),
    };
    let last = { coins: state.coins, gems: state.gems, xp: totalXp() };

    // Called on every commit: compare with the last look and pop a badge for whatever went up.
    function render() {
        const now = { coins: state.coins, gems: state.gems, xp: totalXp() };
        if (now.coins > last.coins) show.coins(now.coins - last.coins);
        if (now.xp > last.xp + 1e-9) show.xp(now.xp - last.xp);
        if (now.gems > last.gems) {
            const n = now.gems - last.gems;
            show.gems(n);
            toast({ icon: "gem", tag: TEXT.diamondTag, title: TEXT.gemsGained(n), text: TEXT.diamondHint, color: "c" });
            sfx.lucky();
        }
        last = now;
    }

    return { render };
}
