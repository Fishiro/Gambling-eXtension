import { FARM } from "./core/config.js";
import { state, commit } from "./store.js";
import * as econ from "./core/economy.js";
import * as items from "./core/items.js";
import * as farming from "./core/farming.js";
import { svgIcon, svgFit } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit } from "./events.js";
import { $, lootLines, patch } from "./ui.js";

// The farm is a garden of clay pots on the stage, the seed bag beside it. The first pot is free, the rest open
// for coins one at a time. An empty pot shows a button for each seed you hold. Planting plays a little scene (the
// seed drops in, a can waters it), then the plant grows through FARM.stages stages until it is ripe.
//
// Each pot is patched on its own, so a pot's animation only starts when that pot's markup changes: `data-anim`
// is in the markup for exactly as long as its animation runs.

const pct = (v) => `+${Math.round(v * 100)}%`;
// 8/3 x UI_SCALE (1.125) = 3 screen pixels per sprite pixel: crisp, and big enough to read the stages.
const ART = 8 / 3;
// How long the planting scene and a stage-up pop run (they match the CSS keyframes).
const PLANT_MS = 2000;
const GROW_MS = 700;
const WATER_AT_MS = 700;

const plantSprite = (seed, stage) => `${seed === "goldseed" ? "g" : ""}plant${stage}`;

export function createFarm({ onLoot, replant }) {
    const el = { panel: $("tab-farm"), garden: $("garden"), bag: $("seed-bag") };
    el.garden.innerHTML = `<div class="plots">${state.garden.map(() => `<div class="plot-cell"></div>`).join("")}</div><div class="garden-all"></div>`;
    const cells = [...el.garden.querySelectorAll(".plot-cell")];
    const allBox = el.garden.querySelector(".garden-all");

    // UI only: when each pot's planting scene / stage-up pop ends, and the stage each pot last showed.
    const plantingUntil = [];
    const growingUntil = [];
    const shownStage = [];

    const has = (id) => items.count(state, id) > 0;

    function artHtml({ plant = "", pot = "pot", extra = "" }) {
        return `<div class="plot-art">
                ${extra}
                <span class="plot-plant">${plant ? svgIcon(plant, ART) : ""}</span>
                <span class="plot-pot">${svgIcon(pot, ART)}</span>
            </div>`;
    }

    // The planting scene: the seed falls into dry soil, the can tips and waters it, the soil turns wet.
    const plantingExtra = (seed) => `<span class="plot-fall">${svgIcon(seed, ART)}</span>
        <span class="plot-can">${svgIcon("can", ART)}</span>
        <span class="plot-drops"><i></i><i></i><i></i></span>
        <span class="plot-dry">${svgIcon("pot", ART)}</span>`;

    function lockedHtml(i) {
        const cost = i === state.plotsOpen ? farming.nextPlotCost(state) : null;
        const foot =
            cost === null
                ? ""
                : `<button class="primary-sm plot-buy" data-action="unlock" data-poor="${state.coins < cost}">${svgFit("coin", 8)}<span>${econ.formatNumber(cost)}</span></button>`;
        return `<div class="plot" data-state="locked" ${cost === null ? "" : 'data-next=""'}>
                <small class="plot-label">${TEXT.plotLocked}</small>
                ${artHtml({ extra: `<span class="plot-lock">${svgFit("lock", 16)}</span>` })}
                <div class="plot-foot">${foot}</div>
            </div>`;
    }

    function emptyHtml(i) {
        const buttons = farming.SEEDS.filter(has)
            .map((id) => `<button class="plot-seed" data-action="plant" data-id="${i}:${id}" title="${TEXT.plantSeed(items.item(id).name)}">${svgFit(id, 16)}</button>`)
            .join("");
        return `<div class="plot" data-state="empty">
                <small class="plot-label">${TEXT.empty}</small>
                ${artHtml({})}
                <div class="plot-foot">${buttons || `<small class="plot-none">${TEXT.noSeedShort}</small>`}</div>
            </div>`;
    }

    function plotHtml(i, now) {
        if (!farming.isOpen(state, i)) return lockedHtml(i);
        const st = farming.plotStatus(state, i, now);
        if (!st) return emptyHtml(i);
        const planting = now < (plantingUntil[i] ?? 0);
        if (st.ready && !planting) {
            const crop = FARM.crops[st.seed].yields[0][0];
            return `<div class="plot" data-state="ready" data-seed="${st.seed}">
                    <small class="plot-label">${TEXT.ripe}</small>
                    ${artHtml({ plant: plantSprite(st.seed, "-ripe"), pot: "pot-wet", extra: `<span class="plot-crop">${svgFit(crop, 16)}</span>` })}
                    <div class="plot-foot"><button class="primary-sm" data-action="harvest" data-id="${i}">${TEXT.harvest}</button></div>
                </div>`;
        }
        // The scene plays over bare soil: a stage reached meanwhile waits until it ends, then pops up.
        const stage = planting ? 0 : st.stage;
        if (shownStage[i] !== undefined && stage > shownStage[i]) growingUntil[i] = now + GROW_MS;
        shownStage[i] = stage;
        const anim = planting ? "plant" : now < (growingUntil[i] ?? 0) ? "grow" : "";
        return `<div class="plot" data-state="growing" data-seed="${st.seed}" ${anim ? `data-anim="${anim}"` : ""}>
                <small class="plot-label">${TEXT.stages[stage]}</small>
                ${artHtml({ plant: stage ? plantSprite(st.seed, stage) : "", pot: "pot-wet", extra: planting ? plantingExtra(st.seed) : "" })}
                <div class="plot-foot plot-grow"><div class="bar"><div class="fill" data-live="plot-${i}"></div></div><small data-live="plot-${i}-left"></small></div>
            </div>`;
    }

    // One seed in the bag: how many, how long it grows and what it can give.
    function seedHtml(id) {
        const crop = FARM.crops[id];
        const drops = crop.yields.map(([y]) => `<span class="seed-drop" data-tip="${y}">${svgFit(y, 14)}</span>`).join("");
        return `<div class="seed-row" ${has(id) ? "" : 'data-out=""'}>
                <span class="row-icon">${svgFit(id, 24)}</span>
                <span class="seed-main">
                    <b>${items.item(id).name} <em>x${items.count(state, id)}</em></b>
                    <small>${TEXT.growTime(crop.minutes)}</small>
                </span>
                <span class="seed-drops">${drops}</span>
            </div>`;
    }

    function bagHtml() {
        const stats = [
            ["GROW SPEED", items.bonus(state, "grow")],
            ["GARDEN YIELD", items.bonus(state, "yield")],
        ]
            .map(([name, v]) => `<div><span>${name}</span><b>${pct(v)}</b></div>`)
            .join("");
        return `${farming.SEEDS.map(seedHtml).join("")}
            <div class="garden-stats">${stats}</div>
            ${
                farming.SEEDS.some(has)
                    ? `<p class="seed-source">${svgFit("chest", 12)}<span>${TEXT.seedsFrom}</span></p>`
                    : `<p class="garden-empty">${svgFit("chest", 12)}<span>${TEXT.noSeeds}</span></p>`
            }`;
    }

    // Progress bars and countdowns change every second; everything else only when its markup does.
    function live(now) {
        state.garden.forEach((_, i) => {
            const st = farming.plotStatus(state, i, now);
            if (!st || st.ready) return;
            const bar = el.garden.querySelector(`[data-live="plot-${i}"]`);
            if (bar) bar.style.width = `${st.progress * 100}%`;
            const label = el.garden.querySelector(`[data-live="plot-${i}-left"]`);
            if (label) label.textContent = econ.formatClock(st.left);
        });
    }

    function render() {
        if (el.panel.hidden) return;
        const now = Date.now();
        cells.forEach((cell, i) => {
            const before = shownStage[i];
            patch(cell, plotHtml(i, now));
            // A stage-up gets a little puff of leaves too.
            if (before !== undefined && shownStage[i] > before) {
                const art = cell.querySelector(".plot-plant");
                const p = fx.centerOf(art ?? cell);
                fx.burst(p.x, p.y, { count: 8, colors: ["G", "g", "w"], speed: [0.6, 1.6], life: [12, 22] });
            }
        });
        patch(allBox, farming.readyPlots(state) > 1 ? `<button class="primary harvest-all" data-action="harvestAll" data-fx="G,y,w">${TEXT.harvestAll}</button>` : "");
        patch(el.bag, bagHtml());
        live(now);
    }

    function popLoot(loot, from) {
        onLoot(loot);
        const lines = lootLines(loot);
        const p = fx.centerOf(from);
        lines.forEach((l, i) => fx.float(p.x, p.y - 12 - i * 14, l.text, { color: l.color, life: 70 }));
        fx.burst(p.x, p.y, { count: 18, colors: ["G", "g", "y"], speed: [1, 3], life: [16, 30] });
    }

    // Start the planting scene on pot `i` (its markup carries data-anim="plant" until it ends).
    function startScene(i) {
        plantingUntil[i] = Date.now() + PLANT_MS;
        shownStage[i] = 0;
        setTimeout(() => sfx.water(), WATER_AT_MS);
        setTimeout(render, PLANT_MS + 50);
    }

    function harvestOne(i, from) {
        const seed = state.garden[i]?.seed;
        const loot = farming.harvest(state, i);
        if (!loot) return null;
        shownStage[i] = undefined;
        const p = fx.centerOf(from);
        if (replant(i, seed)) {
            startScene(i);
            fx.float(p.x, p.y + 16, TEXT.replanted, { color: "G", life: 60 });
        }
        popLoot(loot, from);
        emit("harvest", { loot, seed });
        return loot;
    }

    function plantAt(i, seed, from) {
        if (!farming.plant(state, i, seed)) return deny(from);
        startScene(i);
        commit();
        sfx.plant();
        const p = fx.centerOf(from);
        fx.float(p.x, p.y - 12, TEXT.plantedFor(econ.formatClock(farming.plotStatus(state, i).total)), { color: "G", life: 70 });
        emit("plant", { seed, minutes: state.garden[i].min });
    }

    const plotOf = (i) => cells[i]?.querySelector(".plot");

    const ACTIONS = {
        plant(id, button) {
            const [i, seed] = id.split(":");
            plantAt(Number(i), seed, plotOf(Number(i)) ?? button);
        },
        harvest(id, button) {
            if (!harvestOne(Number(id), plotOf(Number(id)) ?? button)) return deny(button);
            commit();
            sfx.harvest();
        },
        harvestAll(_, button) {
            state.garden.forEach((_, i) => {
                if (farming.plotStatus(state, i)?.ready) harvestOne(i, plotOf(i) ?? button);
            });
            commit();
            sfx.harvest();
        },
        unlock(_, button) {
            const i = state.plotsOpen;
            if (!farming.unlockPlot(state)) return deny(button);
            commit();
            sfx.upgrade();
            const p = fx.centerOf(plotOf(i) ?? button);
            fx.burst(p.x, p.y, { count: 24, colors: ["y", "O", "w"], speed: [1, 3], life: [16, 30] });
            fx.float(p.x, p.y - 16, TEXT.plotOpened, { color: "y", life: 70 });
            emit("plot-unlock", { plots: state.plotsOpen });
        },
    };

    function deny(button) {
        sfx.denied();
        fx.shake(button, 2, 200);
    }

    el.panel.addEventListener("click", (e) => {
        const button = e.target.closest("[data-action]");
        if (button && !button.disabled) ACTIONS[button.dataset.action](button.dataset.id, button);
    });

    return { render, tick: render };
}
