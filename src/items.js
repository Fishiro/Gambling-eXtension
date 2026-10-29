import { ITEMS, DROPS, GEAR, GEAR_MAX, GEAR_GROWTH, GEAR_STARS, STAR_MULT, STAR_COST, GEAR_SETS, SET_STARS, LUCK, PETS } from "./config.js";
import { vipBonus } from "./vip.js";
import { relicBonus } from "./relics.js";

// Pure bag logic. A cost is a map of item id -> amount, where "coins" and "gems" mean the wallets.

export const item = (id) => ITEMS[id];

export const rarityOf = (id) => LUCK.rarities.find((r) => r.id === ITEMS[id].rarity);

const WALLETS = { coins: "coins", gems: "gems" };

export const count = (state, id) => (id in WALLETS ? state[id] : (state.bag[id] ?? 0));

export function add(state, id, n = 1) {
    state.bag[id] = count(state, id) + n;
}

export function addAll(state, loot) {
    Object.entries(loot).forEach(([id, n]) => add(state, id, n));
}

export const canAfford = (state, cost) => Object.entries(cost).every(([id, n]) => count(state, id) >= n);

export function spend(state, cost) {
    if (!canAfford(state, cost)) return false;
    Object.entries(cost).forEach(([id, n]) => {
        if (id in WALLETS) state[id] -= n;
        else state.bag[id] -= n;
    });
    return true;
}

export const gearLevel = (state, id) => state.gear[id] ?? 0;

const MAX_LEVEL = GEAR_MAX + GEAR_STARS;

export const gearStars = (state, id) => Math.max(0, gearLevel(state, id) - GEAR_MAX);

// Levels 1-5 add `per` each; stars 1-5 add STAR_MULT x `per` each.
export const gearValue = (gear, level) => gear.per * (Math.min(level, GEAR_MAX) + STAR_MULT * Math.max(0, level - GEAR_MAX));

export const gearCost = (gear, level) =>
    level >= GEAR_MAX
        ? STAR_COST[level - GEAR_MAX]
        : Object.fromEntries(Object.entries(gear.cost).map(([id, n]) => [id, Math.ceil(n * GEAR_GROWTH ** level)]));

export const isMaxed = (state, gear) => gearLevel(state, gear.id) >= MAX_LEVEL;

export const setActive = (state, set) => set.gear.every((id) => gearStars(state, id) >= SET_STARS);

export const canUpgrade = (state, gear) => !isMaxed(state, gear) && canAfford(state, gearCost(gear, gearLevel(state, gear.id)));

export function upgrade(state, gear) {
    if (isMaxed(state, gear) || !spend(state, gearCost(gear, gearLevel(state, gear.id)))) return false;
    state.gear[gear.id] = gearLevel(state, gear.id) + 1;
    return true;
}

// Everything feeding one stat: gear (and set bonuses), every equipped pet's passive, VIP tier, worn relics.
// Cheap enough to call per frame.
export function bonus(state, stat) {
    const gear = GEAR.reduce((sum, g) => (g.stat === stat ? sum + gearValue(g, gearLevel(state, g.id)) : sum), 0);
    const sets = GEAR_SETS.reduce((sum, set) => (set.stat === stat && setActive(state, set) ? sum + set.per : sum), 0);
    const pets = PETS.reduce((sum, p) => sum + (state.pets?.team?.includes(p.id) && p.passive?.stat === stat ? p.passive.per : 0), 0);
    return gear + sets + pets + vipBonus(state, stat) + relicBonus(state, stat);
}

export function rollDrops(state, source, rand = Math.random) {
    const found = DROPS[source].filter((d) => rand() < d.chance).map((d) => ({ id: d.id, n: 1 }));
    found.forEach((d) => add(state, d.id, d.n));
    return found;
}
