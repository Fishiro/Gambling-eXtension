import { FARM } from "./core/config.js";
import { state, commit } from "./store.js";
import * as econ from "./core/economy.js";
import * as items from "./core/items.js";
import * as farming from "./core/farming.js";
import { svgFit } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit } from "./events.js";
import { $, lootLines, patch } from "./ui.js";

// The farm is a garden: a grid of plots on the stage, the seed bag beside it. An empty plot shows a button for each
// seed you hold; each planting rolls its own grow time.

const pct = (v) => `+${Math.round(v * 100)}%`;

export function createFarm({ onLoot, replant }) {
    const el = { panel: $("tab-farm"), garden: $("garden"), bag: $("seed-bag") };

    const has = (id) => items.count(state, id) > 0;

    function plotHtml(i) {
        const st = farming.plotStatus(state, i);
        if (!st) {
            const buttons = farming.SEEDS.filter(has)
                .map((id) => `<button class="plot-seed" data-action="plant" data-id="${i}:${id}" title="${TEXT.plantSeed(items.item(id).name)}">${svgFit(id, 16)}</button>`)
                .join("");
            return `<div class="plot" data-state="empty">
                    <span class="plot-art">${svgFit("seed", 32)}</span>
                    <small class="plot-label">${TEXT.empty}</small>
                    <div class="plot-actions">${buttons}</div>
                </div>`;
        }
        if (st.ready) {
            const crop = FARM.crops[st.seed].yields[0][0];
            return `<div class="plot" data-state="ready" data-seed="${st.seed}">
                    <span class="plot-art">${svgFit(crop, 32)}</span>
                    <small class="plot-label">${TEXT.ripe}</small>
                    <button class="primary-sm" data-action="harvest" data-id="${i}">${TEXT.harvest}</button>
                </div>`;
        }
        return `<div class="plot" data-state="growing" data-seed="${st.seed}">
                <span class="plot-art">${svgFit("sprout", 32)}</span>
                <small class="plot-label" data-live="plot-${i}-left"></small>
                <div class="bar"><div class="fill" data-live="plot-${i}"></div></div>
            </div>`;
    }

    function gardenHtml() {
        const plots = state.garden.map((_, i) => plotHtml(i)).join("");
        const all = farming.readyPlots(state) > 1 ? `<button class="primary harvest-all" data-action="harvestAll" data-fx="G,y,w">${TEXT.harvestAll}</button>` : "";
        return `<div class="plots">${plots}</div>${all}`;
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
    function live() {
        state.garden.forEach((_, i) => {
            const st = farming.plotStatus(state, i);
            if (!st || st.ready) return;
            const bar = el.garden.querySelector(`[data-live="plot-${i}"]`);
            if (bar) bar.style.width = `${st.progress * 100}%`;
            const label = el.garden.querySelector(`[data-live="plot-${i}-left"]`);
            if (label) label.textContent = econ.formatClock(st.left);
        });
    }

    function render() {
        if (el.panel.hidden) return;
        patch(el.garden, gardenHtml());
        patch(el.bag, bagHtml());
        live();
    }

    function popLoot(loot, from) {
        onLoot(loot);
        const lines = lootLines(loot);
        const p = fx.centerOf(from);
        lines.forEach((l, i) => fx.float(p.x, p.y - 12 - i * 14, l.text, { color: l.color, life: 70 }));
        fx.burst(p.x, p.y, { count: 18, colors: ["G", "g", "y"], speed: [1, 3], life: [16, 30] });
    }

    function harvestOne(i, from) {
        const seed = state.garden[i]?.seed;
        const loot = farming.harvest(state, i);
        if (!loot) return null;
        const p = fx.centerOf(from);
        if (replant(i, seed)) fx.float(p.x, p.y + 16, TEXT.replanted, { color: "G", life: 60 });
        popLoot(loot, from);
        emit("harvest", { loot, seed });
        return loot;
    }

    function plantAt(i, seed, from) {
        if (!farming.plant(state, i, seed)) return deny(from);
        commit();
        sfx.plant();
        const p = fx.centerOf(from);
        fx.float(p.x, p.y - 12, TEXT.plantedFor(econ.formatClock(farming.plotStatus(state, i).total)), { color: "G", life: 70 });
        emit("plant", { seed, minutes: state.garden[i].min });
    }

    const plotOf = (i) => el.garden.querySelectorAll(".plot")[i];

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
