import { FARM } from "./config.js";
import * as items from "./items.js";

// Pure garden logic. Nothing ticks: a plot is a seed, a plant time, a rolled grow time and a stored seed for its
// harvest, so reopening the popup always shows the same outcome.

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

export const SEEDS = Object.keys(FARM.crops);

// A crop's grow time in whole minutes, rolled once when it goes in.
export function rollMinutes(seedId, rand = Math.random) {
    const [lo, hi] = FARM.crops[seedId].minutes;
    return lo + Math.floor(rand() * (hi - lo + 1));
}

// GROW SPEED shortens every plot, never below a fifth of its rolled time. Plots from older saves have no rolled
// time and grow for the crop's longest.
const growMs = (state, plot) => (plot.min ?? FARM.crops[plot.seed].minutes[1]) * MIN * Math.max(0.2, 1 - items.bonus(state, "grow"));

// Sandy's time skip: move every growing plot `ms` closer to done.
export function skipTime(state, ms) {
    state.garden.forEach((plot) => plot && (plot.at -= ms));
}

export function plant(state, index, seedId, now = Date.now(), rand = Math.random) {
    if (!FARM.crops[seedId] || state.garden[index] !== null || !items.spend(state, { [seedId]: 1 })) return false;
    state.garden[index] = { seed: seedId, at: now, min: rollMinutes(seedId, rand), roll: newSeed() };
    return true;
}

export function plotStatus(state, index, now = Date.now()) {
    const plot = state.garden[index];
    if (!plot) return null;
    const total = growMs(state, plot);
    const elapsed = Math.max(0, now - plot.at);
    return { seed: plot.seed, total: total / 1000, progress: Math.min(1, elapsed / total), left: Math.max(0, total - elapsed) / 1000, ready: elapsed >= total };
}

// GARDEN YIELD scales each yield line that lands: x1.35 on 3 herbs is 4 herbs plus a 5% chance at a fifth.
const scaled = (n, mult, rand) => {
    const raw = n * mult;
    return Math.floor(raw) + (rand() < raw % 1 ? 1 : 0);
};

export function harvest(state, index, now = Date.now()) {
    const status = plotStatus(state, index, now);
    if (!status?.ready) return null;
    const rand = seeded(state.garden[index].roll);
    const mult = 1 + items.bonus(state, "yield");
    const loot = {};
    FARM.crops[status.seed].yields.forEach(([id, n, chance]) => {
        if (rand() < chance) loot[id] = (loot[id] ?? 0) + scaled(n, mult, rand);
    });
    items.addAll(state, loot);
    state.garden[index] = null;
    return loot;
}

export const readyPlots = (state, now = Date.now()) => state.garden.filter((_, i) => plotStatus(state, i, now)?.ready).length;

export const needsAttention = (state, now = Date.now()) => readyPlots(state, now) > 0;
