import { FARM } from "./config.js";
import * as items from "./items.js";
import { pickWeighted } from "./luck.js";

// Pure expedition + garden logic. Nothing ticks: every result comes from a start timestamp and a stored seed,
// so reopening the popup always shows the same outcome.

const MIN = 60 * 1000;

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const zoneById = (id) => FARM.zones.find((z) => z.id === id);

export const isZoneOpen = (state, zone) => state.level >= zone.level;

export function startTrip(state, zoneId, tripIndex, now = Date.now()) {
    if (state.trip || !isZoneOpen(state, zoneById(zoneId))) return false;
    state.trip = { zone: zoneId, trip: tripIndex, at: now, seed: newSeed() };
    return true;
}

export function tripStatus(state, now = Date.now()) {
    const t = state.trip;
    if (!t) return null;
    const plan = FARM.trips[t.trip];
    const total = plan.minutes * MIN;
    const elapsed = Math.max(0, now - t.at);
    return { zone: zoneById(t.zone), plan, progress: Math.min(1, elapsed / total), left: Math.max(0, total - elapsed) / 1000, done: elapsed >= total };
}

export const tripRolls = (state, plan, progress = 1) => Math.floor(plan.rolls * progress * (1 + items.bonus(state, "loot")));

// Collect a finished trip, or recall early and keep the share already found.
export function collectTrip(state, now = Date.now()) {
    const status = tripStatus(state, now);
    if (!status) return null;
    const rand = seeded(state.trip.seed);
    const loot = {};
    for (let i = 0; i < tripRolls(state, status.plan, status.progress); i++) {
        const [id] = pickWeighted(status.zone.loot, ([, w]) => w, rand);
        loot[id] = (loot[id] ?? 0) + 1;
    }
    items.addAll(state, loot);
    state.trip = null;
    return { zone: status.zone, loot, early: !status.done };
}

const growMs = (state, seedId) => FARM.crops[seedId].minutes * MIN * Math.max(0.2, 1 - items.bonus(state, "grow"));

// Sandy's time skip: move the expedition and every growing plot `ms` closer to done.
export function skipTime(state, ms) {
    if (state.trip) state.trip.at -= ms;
    state.garden.forEach((plot) => plot && (plot.at -= ms));
}

export function plant(state, index, seedId, now = Date.now()) {
    if (state.garden[index] || !items.spend(state, { [seedId]: 1 })) return false;
    state.garden[index] = { seed: seedId, at: now, roll: newSeed() };
    return true;
}

export function plotStatus(state, index, now = Date.now()) {
    const plot = state.garden[index];
    if (!plot) return null;
    const total = growMs(state, plot.seed);
    const elapsed = Math.max(0, now - plot.at);
    return { seed: plot.seed, progress: Math.min(1, elapsed / total), left: Math.max(0, total - elapsed) / 1000, ready: elapsed >= total };
}

export function harvest(state, index, now = Date.now()) {
    const status = plotStatus(state, index, now);
    if (!status?.ready) return null;
    const rand = seeded(state.garden[index].roll);
    const loot = {};
    FARM.crops[status.seed].yields.forEach(([id, n, chance]) => {
        if (rand() < chance) loot[id] = (loot[id] ?? 0) + n;
    });
    items.addAll(state, loot);
    state.garden[index] = null;
    return loot;
}

export const readyPlots = (state, now = Date.now()) => state.garden.filter((_, i) => plotStatus(state, i, now)?.ready).length;

export const needsAttention = (state, now = Date.now()) => !!tripStatus(state, now)?.done || readyPlots(state, now) > 0;
