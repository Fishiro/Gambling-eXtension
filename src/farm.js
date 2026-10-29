import { FARM, PETS } from "./core/config.js";
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

const SEEDS = Object.keys(FARM.crops);
const clockAt = (ms) => new Date(ms).toTimeString().slice(0, 5);
// What a zone can drop, as a row of item icons big enough to tell apart (hover one for its name).
const zonePreview = (zone) => zone.loot.map(([id]) => `<span class="zone-loot" data-tip="${id}">${svgFit(id, 14)}</span>`).join("");

export function createFarm({ reveal, onLoot, replant }) {
    const el = { panel: $("tab-farm"), trip: $("trip"), garden: $("garden") };
    let zoneId = FARM.zones[0].id;
    let tripIndex = 1;
    let stanceId = FARM.stances[0].id;
    let recallArmed = 0;
    // Pets picked to ride along on the next trip (at most FARM.party.length - 1).
    let party = [];
    const seats = FARM.party.length - 1;

    // Seats for the pets riding along, then every owned pet to pick from. Team pets leave the team when sent.
    function partyHtml() {
        party = party.filter((id) => state.pets.owned.includes(id));
        const seatHtml = Array.from({ length: seats }, (_, i) =>
            party[i]
                ? `<button class="party-seat is-on" data-action="unseat" data-id="${party[i]}" title="${TEXT.partyRemove}">${svgIcon(party[i], 2)}</button>`
                : `<span class="party-seat">+</span>`,
        ).join("");
        const pool = PETS.filter((p) => state.pets.owned.includes(p.id) && !party.includes(p.id))
            .map((p) => `<button class="party-pet" data-action="seat" data-id="${p.id}" ${state.pets.team.includes(p.id) ? `data-team="" title="${TEXT.partyTeam}"` : `title="${p.name}"`} ${party.length >= seats ? "disabled" : ""}>${svgIcon(p.id, 2)}</button>`)
            .join("");
        return `<div class="party">
                <div class="party-head"><b>${TEXT.partyTitle}</b><small data-tier="${party.length}">${TEXT.partyTier[party.length]}</small></div>
                <div class="party-seats">${seatHtml}</div>
                ${pool ? `<div class="party-pool">${pool}</div>` : `<p class="hint">${TEXT.partyNone}</p>`}
            </div>`;
    }

    function pickerHtml() {
        const zone = farming.zoneById(zoneId);
        const plan = FARM.trips[tripIndex];
        const zones = FARM.zones
            .map((z) => {
                const open = farming.isZoneOpen(state, z);
                return `<button class="zone" data-action="zone" data-id="${z.id}" aria-pressed="${z.id === zoneId}" ${open ? "" : "disabled"}>
                    ${svgIcon(z.icon, 2)}<span class="zone-main"><b>${z.name}</b><span class="zone-drops">${open ? zonePreview(z) : TEXT.unlockAt(z.level)}</span></span>
                </button>`;
            })
            .join("");
        const times = FARM.trips
            .map((t, i) => `<button data-action="time" data-id="${i}" class="trip-time ${i === tripIndex ? "is-active" : ""}">${t.label}<small>${TEXT.luckPct(t.luck)}</small></button>`)
            .join("");
        const stance = farming.stanceById(stanceId);
        const stances = FARM.stances
            .map((s) => `<button data-action="stance" data-id="${s.id}" class="trip-time ${s.id === stanceId ? "is-active" : ""}">${s.name}<small>${TEXT.stanceNote(s)}</small></button>`)
            .join("");
        const back = clockAt(Date.now() + plan.minutes * 60000);
        return `<div class="zones">${zones}</div>
            <div class="seg">${times}</div>
            <div class="seg">${stances}</div>
            ${partyHtml()}
            <p class="hint">${TEXT.tripPlan(farming.tripRolls(state, plan, party.length, 1, stance), zone.name, back, TEXT.luckPct(farming.tripLuck(plan, stance)))}</p>
            <button class="primary" data-action="send" data-fx="G,y,w">${TEXT.sendWith(party.length)}</button>`;
    }

    function runningHtml(status) {
        const action = status.done
            ? `<button class="primary" data-action="collect" data-fx="y,G,w">${TEXT.collect}</button>`
            : `<button data-action="recall">${recallArmed ? TEXT.recallSure(farming.tripRolls(state, status.plan, status.pets.length, status.progress, status.stance)) : TEXT.recall}</button>`;
        const crew = status.pets.map((id) => svgIcon(id, 2)).join("");
        return `<div class="trip-run" data-done="${status.done}">
                <span class="trip-art">${svgIcon(status.zone.icon, 4)}</span>
                <div class="row-main">
                    <b>${status.zone.name} <em>${status.plan.label} · ${status.stance.name} · ${TEXT.luckPct(status.luck)}</em></b>
                    ${crew ? `<span class="trip-crew">${svgIcon("miner", 1)}${crew}</span>` : ""}
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
        return `<div class="plots">${plots}</div>${all}${noSeeds ? `<p class="garden-empty">${svgIcon("seed", 2)}<span>${TEXT.noSeeds}</span></p>` : ""}`;
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
        reveal({ icon, title, color: "G", sound: sfx.tripBack, lines: lines.length ? lines : [{ icon: "i-close", text: TEXT.nothingFound }] });
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
        stance(id) {
            stanceId = id;
            render();
        },
        seat(id) {
            if (party.length >= seats || party.includes(id)) return;
            party = [...party, id];
            sfx.seat();
            render();
        },
        unseat(id) {
            party = party.filter((p) => p !== id);
            sfx.unseat();
            render();
        },
        send(_, button) {
            if (!farming.startTrip(state, zoneId, tripIndex, party, stanceId)) return deny(button);
            const pets = party.length;
            party = [];
            commit();
            sfx.tripSend();
            emit("trip-start", { zone: zoneId, pets });
        },
        collect() {
            const { trip } = state;
            const result = farming.collectTrip(state);
            commit();
            announce(result.loot, result.zone.icon, result.early ? TEXT.backEarly : TEXT.diggsBack);
            emit("trip", { zone: trip.zone, minutes: farming.tripStatus({ trip }, trip.at)?.plan.minutes ?? 0, early: result.early, found: Object.keys(result.loot).length, pets: result.pets.length });
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
            sfx.plant();
            emit("plant", { seed });
        },
        harvest(id, button) {
            if (!harvestOne(Number(id), button)) return deny(button);
            commit();
            sfx.harvest();
        },
        harvestAll(_, button) {
            state.garden.forEach((_, i) => {
                const plot = el.garden.querySelectorAll(".plot")[i];
                if (farming.plotStatus(state, i)?.ready) harvestOne(i, plot ?? button);
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
