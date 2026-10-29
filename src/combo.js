import { COMBO } from "./config.js";
import { formatNumber } from "./economy.js";
import * as fx from "./fx.js";
import { sfx, drone } from "./sound.js";
import { emit } from "./events.js";
import { state } from "./store.js";
import { timedLeft } from "./luck.js";

const LAST = COMBO.tiers.length - 1;
const COSMIC = COMBO.cosmicFrom;

const tierAt = (n) => {
    let i = 0;
    while (i < LAST && n >= COMBO.tiers[i + 1].at) i++;
    return i;
};

export function createCombo(root, stage) {
    const el = {
        count: root.querySelector(".combo-count"),
        name: root.querySelector(".combo-name"),
        ore: root.querySelector(".combo-ore"),
        timer: root.querySelector(".combo-timer span"),
    };
    let count = 0;
    let ore = 0;
    let tier = 0;
    let lastHit = 0;
    let watching = false;
    let hideTimer = 0;
    let flashUntil = 0;

    function render() {
        const t = COMBO.tiers[tier];
        root.hidden = count < COMBO.showAt;
        root.removeAttribute("data-dead");
        root.dataset.tier = tier;
        el.count.textContent = `x${formatNumber(count)}`;
        el.name.textContent = t.name;
        if (performance.now() > flashUntil) {
            el.ore.textContent = `+${formatNumber(ore)} ORE`;
            el.ore.removeAttribute("data-flash");
        }
    }

    function flash(text) {
        if (root.hidden || count < COMBO.showAt) return false;
        flashUntil = performance.now() + 700;
        el.ore.textContent = text;
        el.ore.setAttribute("data-flash", "");
        return true;
    }

    function tierUp(next) {
        const t = COMBO.tiers[next];
        const rect = stage.getBoundingClientRect();
        const p = { x: rect.left + rect.width * 0.68, y: rect.top + rect.height * 0.45 };
        const cosmic = next >= COSMIC;
        fx.setAura({ colors: t.colors, glow: t.glow, intensity: t.intensity, stars: t.stars, rainbow: cosmic });
        if (next === COSMIC) drone.start();
        sfx.comboTier(Math.min(next, 8));
        fx.float(p.x, p.y - 8, `${t.name}!`, { color: t.glow, size: next >= 5 ? 24 : 16, rainbow: cosmic, rise: 0.4, life: 80 });
        fx.burst(p.x, p.y, { count: 20 + next * 8, colors: t.colors, speed: [1.5, 3 + next * 0.5], life: [24, 48] });
        fx.shake(stage, 2 + Math.min(next, 8) * 0.6, 260);
        fx.pop(root);
        SPECIALS[t.special]?.(p);
    }

    // The two milestone moments.
    const SPECIALS = {
        // 5,000: the screen goes dark, stars rush in, everything gets pulled toward the rock.
        singularity(p) {
            sfx.cosmicBuild();
            fx.cosmicStorm(p.y, 3000);
            fx.frameMode("cosmic", 3000);
            fx.shake(document.body, 5, 900);
        },
        // 10,000: the full cosmic finale, and the frame stays rainbow while the combo lives.
        bigbang(p) {
            sfx.cosmic();
            fx.cosmicBurst(p.x, p.y);
            fx.confetti(5);
            fx.frameMode("jackpot");
            fx.shake(document.body, 10, 1200);
        },
    };

    function end() {
        const finalCount = count;
        const finalTier = tier;
        emit("combo", { count: finalCount });
        count = 0;
        ore = 0;
        tier = 0;
        fx.setAura(null);
        drone.stop();
        if (finalTier === LAST) fx.frameMode(null);
        if (finalCount < COMBO.minSad) {
            root.hidden = true;
            return;
        }
        root.setAttribute("data-dead", "");
        sfx.deflate(finalTier);
        const p = fx.centerOf(root);
        fx.burst(p.x, p.y, { count: 18 + finalTier * 4, colors: ["S", "s", "l"], angle: Math.PI / 2, spread: 2, speed: [0.3, 1.2], gravity: 0.12, life: [30, 60] });
        fx.float(p.x, p.y + 10, "...", { color: "S", rise: -0.35, life: 60 });
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (!count) root.hidden = true;
        }, 1300);
    }

    // The window tightens with the tier you are in.
    function watch(now) {
        if (timedLeft(state, "phoenix") > 0) lastHit = now;
        const left = 1 - (now - lastHit) / COMBO.tiers[tier].window;
        el.timer.style.width = `${Math.max(0, left) * 100}%`;
        if (left > 0) return requestAnimationFrame(watch);
        watching = false;
        end();
    }

    function hit(gained) {
        clearTimeout(hideTimer);
        count++;
        ore += gained;
        lastHit = performance.now();
        const next = tierAt(count);
        if (next > tier) tierUp(next);
        tier = next;
        sfx.comboTap(count, tier);
        render();
        if (count >= COMBO.showAt) fx.pop(el.count);
        if (tier >= COSMIC && count % COMBO.cosmicPulseEvery === 0) {
            const p = fx.centerOf(stage);
            fx.burst(p.x, p.y, { count: 24 + (tier - COSMIC) * 12, colors: COMBO.tiers[tier].colors, speed: [2, 5 + tier - COSMIC], life: [24, 44] });
        }
        if (!watching) {
            watching = true;
            requestAnimationFrame(watch);
        }
    }

    return { hit, flash, colors: () => COMBO.tiers[tier].colors, tier: () => tier };
}
