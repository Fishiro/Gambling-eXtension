import { state } from "./store.js";
import * as econ from "./economy.js";
import { toast } from "./toast.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

// "+N" tags next to the HUD counters: coins, diamonds and XP. Gains are read off the state itself, so
// every source counts without telling anyone. Gains that land while a tag still shows add up into it.

const SHOW_MS = 1600;

// Every XP point ever earned: the levels already cleared plus the current bar.
function totalXp() {
    let sum = state.xp;
    for (let lv = 1; lv < state.level; lv++) sum += econ.xpToNext(lv);
    return sum;
}

const short = (n) => (n < 10 && n % 1 ? n.toFixed(1) : econ.formatNumber(n));

// The tag sits right after `anchor`.
function tag(anchor, kind, format) {
    const el = document.createElement("span");
    el.className = "gain";
    el.dataset.kind = kind;
    el.hidden = true;
    anchor.after(el);
    let total = 0;
    let timer = 0;
    return (n) => {
        total = el.hidden ? n : total + n;
        el.textContent = format(total);
        el.hidden = false;
        el.classList.remove("is-pop");
        void el.offsetWidth;
        el.classList.add("is-pop");
        clearTimeout(timer);
        timer = setTimeout(() => (el.hidden = true), SHOW_MS);
    };
}

export function createGains() {
    const show = {
        coins: tag($("coins"), "coin", (n) => `+${short(n)}`),
        gems: tag($("gem-count"), "gem", (n) => `+${short(n)}`),
        xp: tag($("xp-text"), "xp", (n) => `+${short(n)} XP`),
    };
    let last = { coins: state.coins, gems: state.gems, xp: totalXp() };

    // Called on every commit: compare with the last look and tag whatever went up.
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
