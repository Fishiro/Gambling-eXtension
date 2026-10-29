import { MINE, LUCK, GEMS, BREW_FX } from "./core/config.js";
import { state, commit } from "./store.js";
import * as econ from "./core/economy.js";
import * as luck from "./core/luck.js";
import * as items from "./core/items.js";
import * as market from "./core/market.js";
import { createMineScene } from "./mine-scene.js";
import { createCombo } from "./combo.js";
import { petById } from "./pets.js";
import { svgIcon, svgFit } from "./sprites.js";
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
        heat: $("overheat"),
        heatLabel: $("overheat-label"),
        heatFill: $("overheat-fill"),
    };

    const scene = createMineScene(el.scene, {
        getFill: () => Math.min(1, econ.oreAt(state) / econ.cartCap(state)),
        getAutoPeriod: () => econ.clamp(2.2 - 0.12 * state.upgrades.drill, 0.6, 2.2) / luck.mineBoost(state),
        isGoldRush: () => luck.mineBoost(state) > 1,
        getPet: () => pets.leader(),
        getSkin: () => state.skins.active,
    });
    let nextBatAt = performance.now() + luck.nextBatDelay();
    let fullWarnedAt = 0;
    const combo = createCombo($("combo"), el.scene);

    const rows = Object.entries(MINE.upgrades).map(([kind, cfg]) => {
        const row = document.createElement("div");
        row.className = "upgrade";
        row.innerHTML = `
            <span class="up-icon">${svgFit(ICONS[kind], 16)}</span>
            <span class="up-info"><b>${cfg.name} <em></em></b><small></small></span>
            <button class="buy" data-fx="y,G,w"></button>`;
        const button = row.querySelector("button");
        button.addEventListener("click", () => buy(kind, row));
        el.upgrades.append(row);
        return { kind, cfg, row, level: row.querySelector("em"), effect: row.querySelector("small"), button };
    });

    let sixSevenTaps = 0;
    // Tap power lately, for the live ORE/MIN readout: [[performance.now(), ore], ...]. It logs what each swing
    // digs at full strength, so a full cart still shows how strong your spam is.
    const RATE_MS = MINE.rateWindowSeconds * 1000;
    const tapLog = [];
    let shownRate = 0;
    const logTap = (ore) => ore > 0 && tapLog.push([performance.now(), ore]);
    // Pick heat only lives for this session: it cools off in seconds, so there is nothing worth saving.
    let pickHeat = 0;
    let pickAt = 0;
    let heatFrame = 0;

    const titanMult = () => (luck.timedLeft(state, "titan") > 0 ? BREW_FX.titanMult : 1);
    const surgeMult = () => (luck.timedLeft(state, "surge") > 0 ? BREW_FX.surgeMult : 1);
    const hypeMult = () => (luck.timedLeft(state, "hype") > 0 ? BREW_FX.hypeMult : 1);

    // Titan Tonic keeps tapping for you, a couple of times a second, even on other tabs.
    function titanTick() {
        if (titanMult() === 1) return;
        const power = econ.tapPower(state) * luck.mineBoost(state) * surgeMult() * BREW_FX.titanMult * BREW_FX.titanTapsPerSec;
        logTap(power);
        const added = econ.addOre(state, power);
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

    // FROSTY's passive cools the pick faster; its BRAIN FREEZE stops heat altogether.
    const coolRate = () => 1 + items.bonus(state, "cool");
    const frozen = () => luck.timedLeft(state, "freeze") > 0;

    // The overheat gauge, redrawn every frame while the pick cools.
    function renderHeat() {
        cancelAnimationFrame(heatFrame);
        const heat = econ.coolHeat(pickHeat, pickAt, performance.now(), coolRate());
        const mult = econ.heatMult(heat);
        el.heat.hidden = heat < MINE.overheat.free / 2;
        el.heat.toggleAttribute("data-hot", mult < 1);
        el.heatFill.style.width = `${Math.min(1, heat / econ.maxHeat()) * 100}%`;
        el.heatLabel.textContent = mult < 1 ? TEXT.overheat(Math.round((1 - mult) * 100)) : TEXT.pickWarm;
        if (heat > 0) heatFrame = requestAnimationFrame(renderHeat);
    }

    // One swing heats the pick and returns its strength: the ore it digs into a cart with room.
    function swing(lucky) {
        const now = performance.now();
        pickHeat = frozen() ? 0 : econ.coolHeat(pickHeat, pickAt, now, coolRate()) + 1;
        pickAt = now;
        const cooled = econ.heatMult(pickHeat);
        renderHeat();
        const power = econ.tapPower(state) * luck.mineBoost(state) * titanMult() * surgeMult() * cooled * (lucky ? MINE.luckyMult : 1);
        logTap(power);
        return { power, overheated: cooled < 1 };
    }

    function tap() {
        emit("tap");
        sixSeven();
        if (econ.oreAt(state) >= econ.cartLimit(state) - 0.001) {
            // Nothing goes in, but the swing still counts toward the ORE/MIN readout (and still heats the pick).
            swing(false);
            const now = performance.now();
            combo.hit(0);
            scene.swing({ power: 0, lucky: false });
            emit("tap-full");
            sfx.cartFull();
            if (now - fullWarnedAt < 1200) return;
            fullWarnedAt = now;
            const p = fx.centerOf(el.scene);
            fx.float(p.x, p.y - 20, TEXT.cartFull, { color: "R", life: 45 });
            fx.shake(el.sell, 3);
            return;
        }
        const lucky = Math.random() < MINE.luckyChance;
        const { power, overheated } = swing(lucky);
        const added = econ.addOre(state, power);
        const chest = luck.chance(LUCK.chestPerTap * (1 + items.bonus(state, "chest")));
        const drops = [...items.rollDrops(state, "tap"), ...(lucky ? items.rollDrops(state, "luckyTap") : [])];
        onOre(added);
        commit();
        if (chest) onChest(el.scene, 0);
        if (drops.length) emit("drops", { drops, from: el.scene });
        sfx.mine();
        combo.hit(added);
        if (lucky) sfx.crystal();
        if (overheated) sfx.sizzle();
        else if (frozen()) sfx.ice();
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
                // Overheated taps pay less but look hotter: extra sparks and a jolt, so spam still feels big.
                if (overheated) {
                    fx.burst(p.x, p.y, { count: 8, colors: ["R", "r", "y", "w"], speed: [2, 4.5], life: [10, 22] });
                    fx.shake(el.scene, 1.5, 120);
                }
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
        market.settle(state);
        const mult = market.sell(state, amount);
        const coins = Math.round(amount * econ.orePrice(state) * mult * hypeMult());
        state.ore -= amount;
        state.coins += coins;
        const levels = econ.gainXp(state, econ.sellXp(coins));
        commit();
        emit("sell", { amount, coins });
        sfx.sell(amount / econ.cartCap(state));
        const p = fx.centerOf(el.sell);
        fx.coinShower(p.x, p.y, Math.min(24, 3 + Math.floor(amount / 15)));
        fx.float(p.x, p.y - 24, `+${econ.formatNumber(coins)}`, { color: "y", life: 55 });
        if (Math.abs(mult - 1) >= 0.05) fx.float(p.x, p.y - 44, `${TEXT.marketLabel} ${market.formatMult(mult)}`, { color: mult > 1 ? "G" : "R", life: 55 });
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
        sfx.mineUpgrade(kind);
        fx.pop(row.querySelector(".up-icon"));
        const p = fx.centerOf(row.querySelector(".up-icon"));
        fx.burst(p.x, p.y, { count: 16, colors: ["G", "y", "w"], speed: [1, 3], angle: -Math.PI / 2, spread: 1.6, life: [18, 32] });
    }

    function updateBat() {
        const now = performance.now();
        if (now < nextBatAt) return;
        nextBatAt = now + luck.nextBatDelay();
        if (state.tab !== "mine" || document.hidden || fx.covered()) return;
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
        sfx.batCatch();
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

    // Once a second: ORE/MIN = the drill (gold rush included) + what your taps dug over the last few seconds.
    // It climbs while you spam and pops each time it does, so a hot combo feels fast.
    function renderRate() {
        const now = performance.now();
        while (tapLog.length && tapLog[0][0] <= now - RATE_MS) tapLog.shift();
        const boost = luck.mineBoost(state);
        const drill = econ.orePerSecond(state) * 60 * boost;
        const taps = econ.tapRate(tapLog, now, RATE_MS);
        const total = Math.round(drill + taps);
        el.rate.textContent = `${econ.formatNumber(total)}/MIN`;
        el.rate.title = TEXT.rateSplit(econ.formatNumber(drill), econ.formatNumber(taps));
        el.rate.toggleAttribute("data-boost", boost > 1);
        el.rate.toggleAttribute("data-tapping", taps > 0);
        if (taps > 0 && total > shownRate * 1.05 && el.rate.offsetParent) fx.pop(el.rate);
        shownRate = total;
    }

    function render() {
        const cap = econ.cartCap(state);
        const limitless = econ.cartLimit(state) === Infinity;
        const now = econ.oreAt(state);
        const ore = Math.floor(now);
        const full = !limitless && now >= cap - 0.001;
        el.ore.textContent = econ.formatNumber(ore);
        el.cap.textContent = limitless ? TEXT.noLimit : econ.formatNumber(cap);
        el.cartFill.style.width = `${Math.min(1, now / cap) * 100}%`;
        el.cartFill.parentElement.toggleAttribute("data-full", full);
        el.cartFill.parentElement.toggleAttribute("data-bottomless", limitless);
        const boost = luck.mineBoost(state);
        el.eta.textContent = limitless ? TEXT.bottomless : full ? TEXT.cartFull : now >= cap ? TEXT.overCap : TEXT.fullIn(econ.formatClock((cap - now) / (econ.orePerSecond(state) * boost)));
        el.eta.toggleAttribute("data-full", full);
        el.sellLabel.textContent = ore ? TEXT.sell(econ.formatNumber(ore)) : TEXT.cartEmpty;
        el.sellGain.innerHTML = ore ? `+${svgIcon("coin", 2)}${econ.formatNumber(Math.round(ore * econ.orePrice(state) * market.quote(state).mult * hypeMult()))}` : "";
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
        titanTick, tap, sell, render, renderRate, updateBat, needsAttention: () => econ.oreAt(state) >= econ.cartCap(state) * 0.9 };
}
