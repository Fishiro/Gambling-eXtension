import { FARM } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import * as items from "./items.js";
import * as farming from "./farming.js";
import { svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit } from "./events.js";
import { $, lootHtml, lootLines, patch } from "./ui.js";

const SEEDS = Object.keys(FARM.crops);
const clockAt = (ms) => new Date(ms).toTimeString().slice(0, 5);
const zonePreview = (zone) => lootHtml(Object.fromEntries(zone.loot.map(([id]) => [id, ""])));

export function createFarm({ reveal, onLoot, replant }) {
    const el = { panel: $("tab-farm"), trip: $("trip"), garden: $("garden") };
    let zoneId = FARM.zones[0].id;
    let tripIndex = 1;
    let recallArmed = 0;

    function pickerHtml() {
        const zone = farming.zoneById(zoneId);
        const plan = FARM.trips[tripIndex];
        const zones = FARM.zones
            .map((z) => {
                const open = farming.isZoneOpen(state, z);
                return `<button class="zone" data-action="zone" data-id="${z.id}" aria-pressed="${z.id === zoneId}" ${open ? "" : "disabled"}>
                    ${svgIcon(z.icon, 2)}<span class="zone-main"><b>${z.name}</b><span class="chips">${open ? zonePreview(z) : TEXT.unlockAt(z.level)}</span></span>
                </button>`;
            })
            .join("");
        const times = FARM.trips
            .map((t, i) => `<button data-action="time" data-id="${i}" class="${i === tripIndex ? "is-active" : ""}">${t.label}</button>`)
            .join("");
        const back = clockAt(Date.now() + plan.minutes * 60000);
        return `<div class="zones">${zones}</div>
            <div class="seg">${times}</div>
            <p class="hint">${TEXT.tripPlan(farming.tripRolls(state, plan), zone.name, back)}</p>
            <button class="primary" data-action="send" data-fx="G,y,w">${TEXT.send}</button>`;
    }

    function runningHtml(status) {
        const action = status.done
            ? `<button class="primary" data-action="collect" data-fx="y,G,w">${TEXT.collect}</button>`
            : `<button data-action="recall">${recallArmed ? TEXT.recallSure(farming.tripRolls(state, status.plan, status.progress)) : TEXT.recall}</button>`;
        return `<div class="trip-run" data-done="${status.done}">
                <span class="trip-art">${svgIcon(status.zone.icon, 4)}</span>
                <div class="row-main">
                    <b>${status.zone.name} <em>${status.plan.label}</em></b>
                    <div class="bar"><div class="fill" data-live="trip"></div></div>
                    <small data-live="trip-left"></small>
                </div>
            </div>
            ${action}`;
    }

    function plotHtml(i) {
        const st = farming.plotStatus(state, i);
        if (!st) {
            const buttons = SEEDS.filter((id) => items.count(state, id) > 0)
                .map((id) => `<button class="primary-sm" data-action="plant" data-id="${i}:${id}">${svgIcon(id, 1)}x${items.count(state, id)}</button>`)
                .join("");
            return `<div class="plot" data-state="empty"><span class="plot-art">${svgIcon("seed", 3)}</span><small>${TEXT.empty}</small><div class="plot-actions">${buttons}</div></div>`;
        }
        if (st.ready) {
            const crop = FARM.crops[st.seed].yields[0][0];
            return `<div class="plot" data-state="ready"><span class="plot-art">${svgIcon(crop, 3)}</span><small>${TEXT.ripe}</small><button class="primary-sm" data-action="harvest" data-id="${i}">${TEXT.harvest}</button></div>`;
        }
        return `<div class="plot" data-state="growing"><span class="plot-art">${svgIcon("sprout", 3)}</span>
            <div class="bar"><div class="fill" data-live="plot-${i}"></div></div><small data-live="plot-${i}-left"></small></div>`;
    }

    function gardenHtml() {
        const plots = state.garden.map((_, i) => plotHtml(i)).join("");
        const all = farming.readyPlots(state) > 1 ? `<button class="primary harvest-all" data-action="harvestAll">${TEXT.harvestAll}</button>` : "";
        // One "no seeds" hint for the whole garden instead of one per empty plot.
        const noSeeds = state.garden.includes(null) && !SEEDS.some((id) => items.count(state, id) > 0);
        return `<div class="plots">${plots}</div>${all}${noSeeds ? `<p class="hint">${TEXT.noSeeds}</p>` : ""}`;
    }

    // Progress bars and countdowns change every second; everything else only when its markup does.
    function live() {
        const set = (key, fill, text) => {
            const bar = el.panel.querySelector(`[data-live="${key}"]`);
            if (bar) bar.style.width = `${fill * 100}%`;
            const label = el.panel.querySelector(`[data-live="${key}-left"]`);
            if (label) label.textContent = text;
        };
        const trip = farming.tripStatus(state);
        if (trip) set("trip", trip.progress, trip.done ? TEXT.tripDone : TEXT.backIn(econ.formatClock(trip.left)));
        state.garden.forEach((_, i) => {
            const st = farming.plotStatus(state, i);
            if (st && !st.ready) set(`plot-${i}`, st.progress, econ.formatClock(st.left));
        });
    }

    function render() {
        if (el.panel.hidden) return;
        const trip = farming.tripStatus(state);
        patch(el.trip, trip ? runningHtml(trip) : pickerHtml());
        patch(el.garden, gardenHtml());
        live();
    }

    // Big moments (a returning trip) get the overlay; a harvest just pops where it happened.
    function announce(loot, icon, title) {
        onLoot(loot);
        const lines = lootLines(loot);
        reveal({ icon, title, color: "G", lines: lines.length ? lines : [{ icon: "i-close", text: TEXT.nothingFound }] });
    }

    function popLoot(loot, from) {
        onLoot(loot);
        const lines = lootLines(loot);
        const p = fx.centerOf(from);
        lines.forEach((l, i) => fx.float(p.x, p.y - 12 - i * 14, l.text, { color: l.color, life: 70 }));
        fx.burst(p.x, p.y, { count: 18, colors: ["G", "g", "y"], speed: [1, 3], life: [16, 30] });
    }

    function harvestOne(i, button) {
        const seed = state.garden[i]?.seed;
        const loot = farming.harvest(state, i);
        if (!loot) return null;
        if (replant(i, seed)) fx.float(fx.centerOf(button).x, fx.centerOf(button).y + 16, TEXT.replanted, { color: "G", life: 60 });
        popLoot(loot, button.closest(".plot") ?? button);
        emit("harvest", { loot });
        return loot;
    }

    const ACTIONS = {
        zone(id) {
            zoneId = id;
            render();
        },
        time(id) {
            tripIndex = Number(id);
            render();
        },
        send(_, button) {
            if (!farming.startTrip(state, zoneId, tripIndex)) return deny(button);
            commit();
            sfx.upgrade();
            emit("trip-start", { zone: zoneId });
        },
        collect() {
            const { trip } = state;
            const result = farming.collectTrip(state);
            commit();
            announce(result.loot, result.zone.icon, result.early ? TEXT.backEarly : TEXT.diggsBack);
            emit("trip", { zone: trip.zone, minutes: FARM.trips[trip.trip].minutes, early: result.early, found: Object.keys(result.loot).length });
        },
        recall() {
            if (!recallArmed) {
                recallArmed = setTimeout(() => {
                    recallArmed = 0;
                    render();
                }, 3000);
                return render();
            }
            clearTimeout(recallArmed);
            recallArmed = 0;
            ACTIONS.collect();
        },
        plant(id, button) {
            const [i, seed] = id.split(":");
            if (!farming.plant(state, Number(i), seed)) return deny(button);
            commit();
            sfx.good();
            emit("plant", { seed });
        },
        harvest(id, button) {
            if (!harvestOne(Number(id), button)) return deny(button);
            commit();
            sfx.coin();
        },
        harvestAll(_, button) {
            state.garden.forEach((_, i) => {
                const plot = el.garden.querySelectorAll(".plot")[i];
                if (farming.plotStatus(state, i)?.ready) harvestOne(i, plot ?? button);
            });
            commit();
            sfx.win();
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
