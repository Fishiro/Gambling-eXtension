import { SYMBOLS, BET_STEPS, BASE_BET_MAX, TIMING, LEVELS, MINE, BURN, COSMIC, LUCK, GEMS, UNLOCKS } from "./config.js";
import { bonus } from "./items.js";
import { vipTier } from "./vip.js";

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const symbolById = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

export const getSymbol = (id) => symbolById[id] ?? { id, name: id.toUpperCase() };

export function rollSymbol() {
    let r = Math.random() * totalWeight;
    for (const s of SYMBOLS) {
        r -= s.weight;
        if (r < 0) return s.id;
    }
    return SYMBOLS[0].id;
}

export const rollReels = () => [rollSymbol(), rollSymbol(), rollSymbol()];

function evaluate([a, b, c]) {
    if (a === b && b === c) return { kind: "triple", symbol: a, mult: symbolById[a].triple, cells: [0, 1, 2] };
    if (a === b) return { kind: "pair", symbol: a, mult: symbolById[a].pair, cells: [0, 1] };
    if (a === c || b === c) return { kind: "near", symbol: c, mult: 0, cells: [] };
    return { kind: "lose", symbol: null, mult: 0, cells: [] };
}

export function burnTier(burned) {
    const tiers = BURN.tiers;
    let i = 0;
    while (i < tiers.length - 1 && burned >= tiers[i + 1].at) i++;
    const tier = tiers[i];
    const next = tiers[i + 1] ?? null;
    if (!next) {
        const over = (burned - tier.at) % BURN.overflowPerChest;
        return { index: i, tier, next, progress: over / BURN.overflowPerChest, toNext: BURN.overflowPerChest - over };
    }
    return { index: i, tier, next, progress: (burned - tier.at) / (next.at - tier.at), toNext: next.at - burned };
}

export function burnBonus(burned) {
    const { tier, next, progress } = burnTier(burned);
    return next ? tier.bonus + (next.bonus - tier.bonus) * progress : tier.bonus;
}

export const burnApplied = (burned, grade) => burnBonus(burned) * BURN.gradeShare[grade];

export function burnOverflowChests(burned) {
    const max = BURN.tiers[BURN.tiers.length - 1].at;
    return Math.max(0, Math.floor((burned - max) / BURN.overflowPerChest));
}

export function formatPercent(fraction) {
    const p = fraction * 100;
    if (p < 10) return `${p.toFixed(3)}%`;
    if (p < 100) return `${p.toFixed(2)}%`;
    return `${formatNumber(p)}%`;
}

export function rollStars(grade, boost = 1) {
    const scale = (grade === "perfect" ? COSMIC.perfectMult : 1) * boost;
    let r = Math.random();
    for (let n = 3; n > 0; n--) {
        r -= COSMIC.odds[n] * scale;
        if (r < 0) return n;
    }
    return 0;
}

// Dicey's loaded die: a roll that would pay nothing is bent into a pair.
export const loadDice = ([a, b, c]) => (evaluate([a, b, c]).mult ? [a, b, c] : [a, a, c]);

export function placeStars(result, stars) {
    const spots = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, stars);
    return result.map((s, i) => (spots.includes(i) ? "cosmic" : s));
}

export function evaluateSpin(result) {
    const starCells = result.flatMap((s, i) => (s === "cosmic" ? [i] : []));
    const stars = starCells.length;
    if (stars === 3) return { kind: "cosmic", symbol: "cosmic", stars, lineMult: 0, mult: COSMIC.payout, cells: [0, 1, 2] };
    const line = evaluate(result.map((s, i) => (s === "cosmic" ? `star${i}` : s)));
    if (!stars) return { ...line, stars, lineMult: line.mult };
    const cfg = stars === 1 ? COSMIC.single : COSMIC.double;
    return {
        ...line,
        kind: line.mult ? line.kind : "star",
        symbol: line.mult ? line.symbol : "cosmic",
        stars,
        lineMult: line.mult,
        mult: line.mult * (cfg.lineMult ?? 1) + cfg.scatter,
        cells: [...line.cells, ...starCells],
    };
}

export const heatBonus = (heat) => 1 + heat * TIMING.heatStep;

export const nextHeat = (heat, grade) => (grade === "miss" ? 0 : Math.min(TIMING.heatMax, heat + 1));

export const nextSkill = (skill, grade) =>
    skill + (TIMING.grades[grade].skill - skill) * TIMING.skillSmoothing;

export function payout(bet, outcome, grade, heat, boost = 1) {
    if (!bet || !outcome.mult) return 0;
    return Math.round(bet * outcome.mult * TIMING.grades[grade].mult * heatBonus(heat) * boost);
}

export function winTier(outcome, win, bet) {
    if (outcome.kind === "cosmic") return "cosmic";
    if (outcome.kind === "triple" && outcome.symbol === "seven") return "jackpot";
    if (!win) return outcome.kind === "near" ? "near" : "lose";
    const x = win / bet;
    if (x >= 20) return "mega";
    if (x >= 6) return "big";
    return "win";
}

export function meterSpec(level, skill, zoneBonus = 0) {
    const { zone, speed, adaptStrength, skillTarget, perfectRatio } = TIMING;
    const adapt = (skillTarget - skill) * adaptStrength;
    const width = clamp((zone.base - zone.perLevel * (level - 1)) * (1 + adapt), zone.min, zone.max) * (1 + zoneBonus);
    const sweep = clamp((speed.base + speed.perLevel * (level - 1)) * (1 - adapt * 0.5), speed.min, speed.max);
    const margin = width / 2 + 0.04;
    const center = margin + Math.random() * (1 - margin * 2);
    return { center, width, perfect: width * perfectRatio, speed: sweep };
}

export function gradeAt(spec, p) {
    const d = Math.abs(p - spec.center);
    if (d <= spec.perfect / 2) return "perfect";
    if (d <= spec.width / 2) return "good";
    return "miss";
}

export const xpToNext = (level) => Math.round(LEVELS.xpBase * LEVELS.xpGrowth ** (level - 1));

// Level opens bet steps up to 10,000; past that each VIP tier opens one more.
const maxBetIndex = (level, vip = 0) => Math.min(BET_STEPS.length - 1, BASE_BET_MAX + vip, LEVELS.firstMaxBetIndex + level - 1);

export const maxBet = (state) => maxBetIndex(state.level, vipTier(state));

// Auto spin is SPINNY's job: it works while SPINNY is on the team.
export const canAutoSpin = (state) => state.pets.team.includes("spinny");

export function unlocksAt(level) {
    const list = [];
    if (maxBetIndex(level) > maxBetIndex(level - 1)) list.push(`BET ${formatNumber(BET_STEPS[maxBetIndex(level)])}`);
    UNLOCKS.filter((u) => u.level === level).forEach((u) => list.push(u.name));
    return list;
}

export function gainXp(state, amount) {
    const gained = [];
    state.xp += amount;
    while (state.xp >= xpToNext(state.level)) {
        state.xp -= xpToNext(state.level);
        state.level += 1;
        const reward = LEVELS.coinRewardPerLevel * state.level;
        const gems = state.level % GEMS.levelEvery === 0 ? GEMS.perMilestone : 0;
        state.coins += reward;
        state.gems += gems;
        gained.push({ level: state.level, reward, gems, unlocks: unlocksAt(state.level) });
    }
    return gained;
}

export const upgradeValue = (kind, lv) => MINE.upgrades[kind].base + MINE.upgrades[kind].step * lv;

export const upgradeCost = (kind, lv) => Math.round(MINE.upgrades[kind].cost * MINE.upgrades[kind].growth ** lv);

export const tapPower = (state) => upgradeValue("pick", state.upgrades.pick) + bonus(state, "tap");

export const orePerSecond = (state) => (upgradeValue("drill", state.upgrades.drill) * (1 + bonus(state, "drill"))) / 60;

export const cartCap = (state) => Math.round(upgradeValue("cart", state.upgrades.cart) * (1 + bonus(state, "cart")));

// Pick heat cooled from `lastAt` to `now` (ms) at `rate` x the base cooling, and what a tap at that heat yields
// (1 = full, down to the floor).
export const coolHeat = (heat, lastAt, now, rate = 1) => Math.max(0, heat - (MINE.overheat.rest * rate * (now - lastAt)) / 1000);
export const heatMult = (heat) => clamp(1 - (heat - MINE.overheat.free) / MINE.overheat.span, MINE.overheat.floor, 1);
// Heat at which a tap hits the floor: the overheat bar is full there.
export const maxHeat = () => MINE.overheat.free + MINE.overheat.span * (1 - MINE.overheat.floor);

export const orePrice = (state) => MINE.orePrice * (1 + bonus(state, "sell"));

// state.ore is the cart at time state.mineAt; anything later is derived, never ticked.
export function oreAt(state, now = Date.now()) {
    const span = Math.max(0, now - state.mineAt);
    const rushed = clamp(state.buffs.goldRush - state.mineAt, 0, span);
    const mined = (orePerSecond(state) * (rushed * LUCK.goldRushMult + span - rushed)) / 1000;
    return Math.min(cartCap(state), state.ore + mined);
}

// Bake the drilled ore into state.ore. Call before anything that reads or changes ore, rate, cap or gold rush.
export function settleOre(state, now = Date.now()) {
    const before = state.ore;
    state.ore = Math.max(before, oreAt(state, now));
    state.mineAt = now;
    return state.ore - before;
}

export function addOre(state, amount) {
    settleOre(state);
    const before = state.ore;
    state.ore = Math.min(cartCap(state), state.ore + amount);
    return state.ore - before;
}

const SUFFIXES = ["", "K", "M", "B", "T", "Q"];

export function formatNumber(n) {
    const v = Math.floor(n);
    if (v < 10000) return v.toLocaleString("en-US");
    const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(v) / 3));
    const x = v / 1000 ** tier;
    return `${x.toFixed(x < 100 ? 1 : 0)}${SUFFIXES[tier]}`;
}

export function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const h = Math.floor(s / 3600);
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
}
