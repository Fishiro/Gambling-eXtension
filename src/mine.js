import { MINE, LUCK, GEMS, BREW_FX } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import * as luck from "./luck.js";
import * as items from "./items.js";
import { createMineScene } from "./mine-scene.js";
import { createCombo } from "./combo.js";
import { petById } from "./pets.js";
import { svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit } from "./events.js";
import { $ } from "./ui.js";

const ICONS = { pick: "i-pick", drill: "i-drill", cart: "i-cart" };

export function createMine({ onLevelUp, onChest, onOre, pets }) {
    const el = {
        scene: $("mine-scene"),
        ore: $("ore"),
        cap: $("cap"),
        cartFill: $("cart-fill"),
        eta: $("mine-eta"),
        rate: $("mine-rate"),
        sell: $("btn-sell"),
        sellLabel: $("sell-label"),
        sellGain: $("sell-gain"),
        upgrades: $("upgrades"),
    };

    const scene = createMineScene(el.scene, {
        getFill: () => econ.oreAt(state) / econ.cartCap(state),
        getAutoPeriod: () => econ.clamp(2.2 - 0.12 * state.upgrades.drill, 0.6, 2.2) / luck.mineBoost(state),
        isGoldRush: () => luck.mineBoost(state) > 1,
        getPet: () => pets.activeId(),
        getSkin: () => state.skins.active,
    });
    let nextBatAt = performance.now() + luck.nextBatDelay();
    let fullWarnedAt = 0;
    const combo = createCombo($("combo"), el.scene);

    const rows = Object.entries(MINE.upgrades).map(([kind, cfg]) => {
        const row = document.createElement("div");
        row.className = "upgrade";
        row.innerHTML = `
            <span class="up-icon">${svgIcon(ICONS[kind], 2)}</span>
            <span class="up-info"><b>${cfg.name} <em></em></b><small></small></span>
            <button class="buy" data-fx="y,G,w"></button>`;
        const button = row.querySelector("button");
        button.addEventListener("click", () => buy(kind, row));
        el.upgrades.append(row);
        return { kind, cfg, row, level: row.querySelector("em"), effect: row.querySelector("small"), button };
    });

    let sixSevenTaps = 0;

    const titanMult = () => (luck.timedLeft(state, "titan") > 0 ? BREW_FX.titanMult : 1);

    // Titan Tonic keeps tapping for you, a couple of times a second, even on other tabs.
    function titanTick() {
        if (titanMult() === 1) return;
        const added = econ.addOre(state, econ.tapPower(state) * luck.mineBoost(state) * BREW_FX.titanMult * BREW_FX.titanTapsPerSec);
        if (added <= 0) return;
        onOre(added);
        commit();
        if (el.scene.offsetParent) scene.swing({ power: added, lucky: false });
    }

    function sixSeven() {
        if (state.skins.active !== "sixseven" || ++sixSevenTaps % 67) return;
        sfx.sixSeven();
        scene.glitch();
        fx.shake(el.scene, 4, 400);
        const p = fx.centerOf(el.scene);
        fx.float(p.x, p.y - 10, TEXT.sixSeven, { size: 24, rainbow: true, rise: 0.25, life: 110 });
    }

    function tap() {
        emit("tap");
        sixSeven();
        if (econ.oreAt(state) >= econ.cartCap(state) - 0.001) {
            const now = performance.now();
            combo.hit(0);
            scene.swing({ power: 0, lucky: false });
            emit("tap-full");
            if (now - fullWarnedAt < 1200) return;
            fullWarnedAt = now;
            sfx.denied();
            const p = fx.centerOf(el.scene);
            fx.float(p.x, p.y - 20, TEXT.cartFull, { color: "R", life: 45 });
            fx.shake(el.sell, 3);
            return;
        }
        const lucky = Math.random() < MINE.luckyChance;
        const added = econ.addOre(state, econ.tapPower(state) * luck.mineBoost(state) * titanMult() * (lucky ? MINE.luckyMult : 1));
        const chest = luck.chance(LUCK.chestPerTap * (1 + items.bonus(state, "chest")));
        const drops = [...items.rollDrops(state, "tap"), ...(lucky ? items.rollDrops(state, "luckyTap") : [])];
        onOre(added);
        commit();
        if (chest) onChest(el.scene, 0);
        if (drops.length) emit("drops", { drops, from: el.scene });
        sfx.mine();
        combo.hit(added);
        if (lucky) sfx.lucky();
        if (lucky && luck.chance(GEMS.luckyTapChance)) {
            state.gems += 1;
            const p = fx.centerOf(el.scene);
            fx.float(p.x, p.y - 36, TEXT.gemsGained(1), { color: "c", size: 16, life: 90 });
        }
        const heat = combo.tier();
        scene.swing({
            power: added,
            lucky,
            onHit(p) {
                fx.burst(p.x, p.y, {
                    count: lucky ? 22 : 6 + heat * 2,
                    colors: lucky ? ["y", "c", "G", "R", "w"] : combo.colors(),
                    speed: [1, lucky ? 4 : 2.5 + heat * 0.3],
                    life: [14, 28],
                });
                const label = `${TEXT.lucky} +${Math.round(added)}`;
                if (lucky && !combo.flash(label)) fx.float(p.x, p.y - 30, label, { color: "y", size: 16, life: 60 });
            },
        });
    }

    function sell() {
        econ.settleOre(state);
        const amount = Math.floor(state.ore);
        if (!amount) {
            sfx.denied();
            fx.shake(el.sell, 3);
            return;
        }
        const coins = Math.round(amount * econ.orePrice(state));
        state.ore -= amount;
        state.coins += coins;
        const levels = econ.gainXp(state, amount * MINE.xpPerOre);
        commit();
        emit("sell", { amount });
        sfx.coin();
        const p = fx.centerOf(el.sell);
        fx.coinShower(p.x, p.y, Math.min(24, 3 + Math.floor(amount / 15)));
        fx.float(p.x, p.y - 24, `+${econ.formatNumber(coins)}`, { color: "y", life: 55 });
        if (levels.length) onLevelUp(levels);
    }

    function buy(kind, row) {
        const lv = state.upgrades[kind];
        const cost = econ.upgradeCost(kind, lv);
        if (state.coins < cost) {
            sfx.denied();
            fx.shake(row, 2, 200);
            return;
        }
        econ.settleOre(state);
        state.coins -= cost;
        state.upgrades[kind] = lv + 1;
        commit();
        sfx.upgrade();
        fx.pop(row.querySelector(".up-icon"));
        const p = fx.centerOf(row.querySelector(".up-icon"));
        fx.burst(p.x, p.y, { count: 16, colors: ["G", "y", "w"], speed: [1, 3], angle: -Math.PI / 2, spread: 1.6, life: [18, 32] });
    }

    function updateBat() {
        const now = performance.now();
        if (now < nextBatAt) return;
        nextBatAt = now + luck.nextBatDelay();
        if (state.tab !== "mine" || document.hidden) return;
        scene.spawnBat(LUCK.batSeconds);
        sfx.bat();
        const p = fx.centerOf(el.scene);
        fx.float(p.x, p.y - 20, TEXT.batAppears, { color: "y", rise: 0.3, life: 70 });
        if (pets.ready("banana")) setTimeout(autoCatch, 1100);
    }

    function autoCatch() {
        if (!scene.hasBat() || !pets.trigger("banana")) return;
        const caught = scene.petCatch();
        if (caught) gotBat(caught, TEXT.petCaught, petById("banana").catchBoost);
    }

    function gotBat(at, label, boost = LUCK.batBoost) {
        state.fun.bats = (state.fun.bats ?? 0) + 1;
        sfx.lucky();
        fx.burst(at.x, at.y, { count: 30, colors: ["y", "w", "Y"], speed: [1.5, 4.5], life: [20, 40] });
        fx.float(at.x, at.y - 16, label, { color: "y", life: 60 });
        emit("drops", { drops: items.rollDrops(state, "bat"), from: el.scene });
        onChest(el.scene, boost);
    }

    function onScenePointer(e) {
        const caught = scene.catchBat(e.clientX, e.clientY);
        if (caught) return gotBat(caught, TEXT.batCaught);
        if (scene.hitPet(e.clientX, e.clientY)) return pets.pat(e.clientX, e.clientY);
        tap();
    }

    function render() {
        const cap = econ.cartCap(state);
        const now = econ.oreAt(state);
        const ore = Math.floor(now);
        const full = now >= cap - 0.001;
        el.ore.textContent = econ.formatNumber(ore);
        el.cap.textContent = econ.formatNumber(cap);
        el.cartFill.style.width = `${(now / cap) * 100}%`;
        el.cartFill.parentElement.toggleAttribute("data-full", full);
        const boost = luck.mineBoost(state);
        el.rate.textContent = `${econ.formatNumber(econ.orePerSecond(state) * 60 * boost)}/MIN`;
        el.rate.toggleAttribute("data-boost", boost > 1);
        el.eta.textContent = full ? TEXT.cartFull : TEXT.fullIn(econ.formatClock((cap - now) / (econ.orePerSecond(state) * boost)));
        el.eta.toggleAttribute("data-full", full);
        el.sellLabel.textContent = ore ? TEXT.sell(econ.formatNumber(ore)) : TEXT.cartEmpty;
        el.sellGain.innerHTML = ore ? `+${svgIcon("coin", 2)}${econ.formatNumber(Math.round(ore * econ.orePrice(state)))}` : "";
        el.sell.disabled = !ore;
        el.sell.toggleAttribute("data-ready", ore >= cap * 0.5);

        rows.forEach(({ kind, cfg, level, effect, button }) => {
            const lv = state.upgrades[kind];
            const cost = econ.upgradeCost(kind, lv);
            level.textContent = `LV${lv}`;
            effect.innerHTML = `${econ.formatNumber(econ.upgradeValue(kind, lv))}${svgIcon("next", 1)}${econ.formatNumber(econ.upgradeValue(kind, lv + 1))}${cfg.unit}`;
            button.innerHTML = `${svgIcon("coin", 2)}${econ.formatNumber(cost)}`;
            button.disabled = state.coins < cost;
        });
    }

    el.scene.addEventListener("pointerdown", onScenePointer);
    el.sell.addEventListener("click", sell);

    return {
        titanTick, tap, sell, render, updateBat, needsAttention: () => econ.oreAt(state) >= econ.cartCap(state) * 0.9 };
}
