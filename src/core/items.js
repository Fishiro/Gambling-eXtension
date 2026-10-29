import { ITEMS, DROPS, BREWS, FARM, GEAR, GEAR_MAX, GEAR_GROWTH, GEAR_STARS, STAR_MULT, STAR_COST, STAR_CHANCE, CRAFT_FEE, GEAR_SETS, SET_STARS, LUCK, PETS, STAT_CAPS } from "./config.js";
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

// Materials grow by GEAR_GROWTH per level, plus the craft fee in coins; a star pays STAR_COST.
export function gearCost(gear, level) {
    if (level >= GEAR_MAX) return STAR_COST[level - GEAR_MAX];
    const scale = GEAR_GROWTH ** level;
    const materials = Object.fromEntries(Object.entries(gear.cost).map(([id, n]) => [id, Math.ceil(n * scale)]));
    return { coins: Math.ceil(CRAFT_FEE.gear * scale), ...materials };
}

// A brew's ingredients plus its coin fee (by the rarity of the brew).
export const brewCost = (brew) => ({ coins: CRAFT_FEE.brew[ITEMS[brew.id].rarity], ...brew.cost });

export const isMaxed = (state, gear) => gearLevel(state, gear.id) >= MAX_LEVEL;

export const setActive = (state, set) => set.gear.every((id) => gearStars(state, id) >= SET_STARS);

export const canUpgrade = (state, gear) => !isMaxed(state, gear) && canAfford(state, gearCost(gear, gearLevel(state, gear.id)));

// The chance the next upgrade of `gear` works: always for LV1-5, STAR_CHANCE for each star.
export const upgradeChance = (state, gear) => STAR_CHANCE[gearStars(state, gear.id)] ?? (gearLevel(state, gear.id) < GEAR_MAX ? 1 : 0);

// Pay and try: "up" when the piece gained a level or star, "crack" when a star attempt failed and cost a star,
// "fail" when it failed with no star to lose, null when it can't be paid or is maxed. The cost is spent either way.
export function upgrade(state, gear, rand = Math.random) {
    const lv = gearLevel(state, gear.id);
    if (isMaxed(state, gear) || !spend(state, gearCost(gear, lv))) return null;
    if (lv >= GEAR_MAX && rand() >= upgradeChance(state, gear)) {
        if (lv === GEAR_MAX) return "fail";
        state.gear[gear.id] = lv - 1;
        return "crack";
    }
    state.gear[gear.id] = lv + 1;
    return "up";
}

// Diminishing returns past `knee`: slope 1 at the knee, easing toward `cap` and never reaching it.
export function softcap(raw, { knee, cap }) {
    if (raw <= knee) return raw;
    const room = cap - knee;
    const over = raw - knee;
    return knee + (room * over) / (over + room);
}

// Everything feeding one stat before the cap: gear (and set bonuses), every equipped pet's passive, VIP tier,
// worn relics.
export function rawBonus(state, stat) {
    const gear = GEAR.reduce((sum, g) => (g.stat === stat ? sum + gearValue(g, gearLevel(state, g.id)) : sum), 0);
    const sets = GEAR_SETS.reduce((sum, set) => (set.stat === stat && setActive(state, set) ? sum + set.per : sum), 0);
    const pets = PETS.reduce((sum, p) => sum + (state.pets?.team?.includes(p.id) && p.passive?.stat === stat ? p.passive.per : 0), 0);
    return gear + sets + pets + vipBonus(state, stat) + relicBonus(state, stat);
}

// The stat as the game uses it: raw sources plus `extra` (e.g. burn for payout), through STAT_CAPS.
// Cheap enough to call per frame.
export function bonus(state, stat, extra = 0) {
    const raw = rawBonus(state, stat) + extra;
    return STAT_CAPS[stat] ? softcap(raw, STAT_CAPS[stat]) : raw;
}

// Every recipe that needs item `id`, with how many one craft takes: gear levels (LV1 materials), gear stars,
// brews, and the garden for seeds. `brew` is set on brew uses so callers can hide secret recipes.
export function usesOf(id) {
    const uses = [];
    for (const g of GEAR) if (g.cost[id]) uses.push({ kind: "gear", name: g.name, icon: g.icon, n: g.cost[id] });
    const star = STAR_COST.find((c) => c[id]);
    if (star) uses.push({ kind: "star", name: "GEAR STARS", icon: "pstar", n: star[id] });
    for (const b of BREWS) if (b.cost[id]) uses.push({ kind: "brew", name: ITEMS[b.id].name, icon: b.id, n: b.cost[id], brew: b });
    if (FARM.crops[id]) uses.push({ kind: "plant", name: "GARDEN", icon: "sprout", n: 1 });
    return uses;
}

// How many of `id` the brews need at most (one craft): scrapping past this never blocks a brew.
export const brewNeed = (id) => Math.max(0, ...BREWS.map((b) => b.cost[id] ?? 0));

export function rollDrops(state, source, rand = Math.random) {
    const found = DROPS[source].filter((d) => rand() < d.chance).map((d) => ({ id: d.id, n: 1 }));
    found.forEach((d) => add(state, d.id, d.n));
    return found;
}
