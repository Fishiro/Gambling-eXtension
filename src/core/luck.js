import { LUCK, BET_STEPS, TIMING, ITEMS, SCRAP } from "./config.js";
import * as relics from "./relics.js";
import * as econ from "./economy.js";
import * as items from "./items.js";

export const pickWeighted = (list, weightOf, rand = Math.random) => {
    let r = rand() * list.reduce((sum, entry) => sum + weightOf(entry), 0);
    for (const entry of list) {
        r -= weightOf(entry);
        if (r < 0) return entry;
    }
    return list[list.length - 1];
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const rarityIndex = (rarity) => LUCK.rarities.indexOf(rarity);

// A boost of LUCK.legendaryBoost or more is a sure legendary (Luck Brew).
export const rollRarity = (boost = 0, rand = Math.random) =>
    boost >= LUCK.legendaryBoost
        ? LUCK.rarities[LUCK.rarities.length - 1]
        : pickWeighted(LUCK.rarities, (r) => (r.id === "common" ? r.weight : r.weight * (1 + boost)), rand);

const byRarity = Object.fromEntries(LUCK.rarities.map((r) => [r.id, r]));

// The rarity of the next chest opened, with bad-luck protection: state.pity counts chests since the last
// epic-or-better and since the last legendary, and a counter at its LUCK.pity limit forces that rarity.
export function openRarity(state, boost = 0, rand = Math.random) {
    const pity = (state.pity ??= { epic: 0, legendary: 0 });
    let rarity = rollRarity(boost, rand);
    if (pity.legendary + 1 >= LUCK.pity.legendary) rarity = byRarity.legendary;
    else if (pity.epic + 1 >= LUCK.pity.epic && rarityIndex(rarity) < rarityIndex(byRarity.epic)) rarity = byRarity.epic;
    const rank = rarityIndex(rarity);
    pity.epic = rank >= rarityIndex(byRarity.epic) ? 0 : pity.epic + 1;
    pity.legendary = rarity === byRarity.legendary ? 0 : pity.legendary + 1;
    return rarity;
}

export const rollReward = (rarity) => pick(LUCK.rewards[rarity.id]);

export const chance = (p) => Math.random() < p;

export const nextBatDelay = () => -Math.log(1 - Math.random()) * LUCK.batMeanSeconds * 1000;

export const timedLeft = (state, key) => Math.max(0, (state.buffs[key] ?? 0) - Date.now()) / 1000;

export const mineBoost = (state) => (timedLeft(state, "goldRush") > 0 ? LUCK.goldRushMult : 1);

export function addChest(state, boost = 0) {
    if (state.chests.length >= LUCK.maxChests) return false;
    state.chests.push(boost);
    return true;
}

// The coin unit chest rewards (and scrap) scale with: about the bet the player usually makes, smaller early on.
export function rewardUnit(state) {
    const maxBet = BET_STEPS[econ.maxBet(state)];
    const typical = econ.clamp(state.betEma || maxBet, BET_STEPS[1], maxBet);
    const early = Math.max(LUCK.earlyFloor, Math.min(1, state.level / LUCK.earlyLevels));
    return typical * early;
}

export const trackBet = (state, bet) => {
    state.betEma = state.betEma ? state.betEma + (bet - state.betEma) * LUCK.betSmoothing : bet;
};

// Junk scrap: what one piece of junk `id` is worth in coins right now.
export const scrapValue = (state, id) => (ITEMS[id]?.junk ? Math.max(1, Math.round(rewardUnit(state) * SCRAP[ITEMS[id].rarity])) : 0);

// Scrap every piece of junk `id` for coins. The item stays known (the junk collection still counts it).
export function scrap(state, id) {
    const n = state.bag[id] ?? 0;
    const coins = n * scrapValue(state, id);
    if (!coins) return 0;
    state.bag[id] = 0;
    state.coins += coins;
    return coins;
}

// A reward line: `n` is the amount, `fmt` turns any amount back into text so lines can be summed.
const line = (icon, key, n, fmt, extra) => ({ icon, key, n, fmt, text: fmt(n), ...extra });

const APPLY = {
    coins(state, r) {
        const amount = Math.max(1, Math.round(rewardUnit(state) * r.mult));
        state.coins += amount;
        return [line("coin", "coin", amount, (n) => `+${econ.formatNumber(n)} COIN`)];
    },
    ore(state, r) {
        const added = econ.addOre(state, econ.cartCap(state) * r.fill);
        if (added < 1) return APPLY.coins(state, { mult: LUCK.fallbackMult.ore });
        return [line("ore", "ore", added, (n) => `+${econ.formatNumber(n)} ORE`)];
    },
    xp(state, r) {
        const amount = Math.ceil(econ.xpToNext(state.level) * r.frac);
        return [line("i-star", "xp", amount, (n) => `+${econ.formatNumber(n)} XP`, { xp: amount })];
    },
    freeSpin(state) {
        if (state.freeSpin) return APPLY.coins(state, { mult: LUCK.fallbackMult.freeSpin });
        state.freeSpin = true;
        return [line("i-gift", "freeSpin", 1, () => "FREE SPIN")];
    },
    heat(state, r) {
        state.heat = Math.min(TIMING.heatMax, state.heat + r.amount);
        return [line("flame", "heat", r.amount, (n) => `HEAT +${n}`)];
    },
    goldRush(state, r) {
        econ.settleOre(state);
        state.buffs.goldRush = Math.max(Date.now(), state.buffs.goldRush) + r.seconds * 1000;
        return [line("ore", "goldRush", r.seconds, (n) => `GOLD RUSH ${n}S, MINE x${LUCK.goldRushMult}`)];
    },
    hotMachine(state, r) {
        state.buffs.hotSpins += r.spins;
        return [line("flame", "hotMachine", r.spins, (n) => `HOT MACHINE ${n} SPINS x${LUCK.hotMachineMult}`)];
    },
    item(state, r) {
        items.add(state, r.id, r.n);
        return [line(r.id, `item:${r.id}`, r.n, (n) => `+${n} ${items.item(r.id).name}`)];
    },
    relic(state, r) {
        const relic = relics.rollRelic(r.floor ?? 0);
        const dust = relics.addRelic(state, relic);
        if (dust) return [line("relicDust", "relicDust", dust, (n) => `+${n} RELIC DUST (CASE FULL)`)];
        return [line("relic", `relic:${relic.uid}`, 1, () => `${relic.rarity.toUpperCase()} RELIC: ${relics.relicName(relic)}`)];
    },
    gems(state, r) {
        state.gems += r.n;
        return [line("gem", "gems", r.n, (n) => `+${n} DIAMOND${n > 1 ? "S" : ""}`)];
    },
    chest(state, r) {
        const n = r.n ?? 1;
        let added = 0;
        for (let i = 0; i < n; i++) if (addChest(state, r.boost)) added++;
        if (!added) return APPLY.coins(state, { mult: LUCK.fallbackMult.bundle });
        const kind = r.boost >= LUCK.legendaryBoost ? "LEGENDARY" : "BLESSED";
        return [line("chest", `chest:${kind}`, added, (k) => `+${k} ${kind} CHEST${k > 1 ? "S" : ""}`)];
    },
    // Brew buffs: a timer that stacks, or a number of spins.
    timed(state, r) {
        state.buffs[r.key] = Math.max(Date.now(), state.buffs[r.key] ?? 0) + r.seconds * 1000;
        return [line("i-star", r.key, r.seconds, () => r.label)];
    },
    spins(state, r) {
        state.buffs[r.key] = (state.buffs[r.key] ?? 0) + r.n;
        return [line("i-star", r.key, r.n, () => r.label)];
    },
    bundle(state) {
        return [
            ...APPLY.coins(state, { mult: LUCK.fallbackMult.bundle }),
            ...APPLY.goldRush(state, { seconds: 120 }),
            ...APPLY.hotMachine(state, { spins: 10 }),
        ];
    },
};

// Sum lines with the same key: three "+40 COIN" become one "+120 COIN".
export function mergeLines(lines) {
    const merged = new Map();
    for (const l of lines) {
        const prev = merged.get(l.key);
        merged.set(l.key, prev ? { ...prev, n: prev.n + l.n, text: prev.fmt(prev.n + l.n) } : l);
    }
    return [...merged.values()];
}

export function applyReward(state, reward) {
    const lines = APPLY[reward.type](state, reward);
    const xp = lines.reduce((sum, l) => sum + (l.xp ?? 0), 0);
    return { lines, levels: xp ? econ.gainXp(state, xp) : [] };
}
