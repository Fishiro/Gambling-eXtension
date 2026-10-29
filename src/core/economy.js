import { SYMBOLS, EASY_KEEP, BET, PET_REEL, TIMING, LEVELS, MINE, BURN, COSMIC, LUCK, GEMS, UNLOCKS, FARM, BREW_FX } from "./config.js";
import { bonus } from "./items.js";

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const symbolById = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

export const getSymbol = (id) => symbolById[id] ?? { id, name: id.toUpperCase() };

export function rollSymbol(rand = Math.random) {
    let r = rand() * totalWeight;
    for (const s of SYMBOLS) {
        r -= s.weight;
        if (r < 0) return s.id;
    }
    return SYMBOLS[0].id;
}

// A symbol other than `not`, by weight.
function rollOther(not, rand) {
    const pool = SYMBOLS.filter((s) => s.id !== not);
    let r = rand() * pool.reduce((sum, s) => sum + s.weight, 0);
    for (const s of pool) if ((r -= s.weight) < 0) return s.id;
    return pool[0].id;
}

// The machine's roll. A line of an `easy` symbol only lands EASY_KEEP of the time; otherwise the middle reel
// slips to another symbol, leaving a near miss (it can never make a new line, since reel 1 keeps its symbol).
export function rollReels(rand = Math.random) {
    const roll = [rollSymbol(rand), rollSymbol(rand), rollSymbol(rand)];
    const [a, b] = roll;
    if (a === b && symbolById[a].easy && rand() >= EASY_KEEP) roll[1] = rollOther(a, rand);
    return roll;
}

// Exact odds of each line per spin (stars aside), with the easy slip: { id: { triple, pair } }.
export function lineOdds() {
    return Object.fromEntries(
        SYMBOLS.map((s) => {
            const p = s.weight / totalWeight;
            const keep = s.easy ? EASY_KEEP : 1;
            return [s.id, { triple: p ** 3 * keep, pair: p * p * (1 - p) * keep }];
        }),
    );
}

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

export function rollStars(grade, boost = 1, rand = Math.random) {
    const scale = (grade === "perfect" ? COSMIC.perfectMult : 1) * boost;
    let r = rand();
    for (let n = 3; n > 0; n--) {
        r -= COSMIC.odds[n] * scale;
        if (r < 0) return n;
    }
    return 0;
}

// A roll that pays nothing bent into a pair, never a triple: [a, b, c] -> [a, a, c], or [b, b, a] for a near
// miss like 7-?-7 where c is a (copying a would make the triple).
export function loadDice([a, b, c]) {
    if (evaluate([a, b, c]).mult) return [a, b, c];
    return c === a ? [b, b, a] : [a, a, c];
}

// The natural chance of 7-7-7 on a spin (an easy-slip can't touch it: SEVEN is not easy).
const naturalJackpot = (symbolById.seven.weight / totalWeight) ** 3;

// Pets raise reel odds, never force them. `seven`: SEVEN's buff, a total PET_REEL.jackpotMax chance of 7-7-7
// (natural odds included). `bend`: DICEY or SIX, a PET_REEL.bendChance chance to turn a dead roll into a pair.
export function petBend(roll, { seven = false, bend = false } = {}, rand = Math.random) {
    if (seven && rand() < (PET_REEL.jackpotMax - naturalJackpot) / (1 - naturalJackpot)) return { roll: ["seven", "seven", "seven"], jackpot: true, bent: false };
    if (bend && !evaluate(roll).mult && rand() < PET_REEL.bendChance) return { roll: loadDice(roll), jackpot: false, bent: true };
    return { roll, jackpot: false, bent: false };
}

export function placeStars(result, stars, rand = Math.random) {
    const spots = [0, 1, 2].sort(() => rand() - 0.5).slice(0, stars);
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

// Everything a bet spin's win is multiplied by besides the line, grade and heat: the lucky and hot spin
// spikes, the payout stat (burn included, through its soft cap) and MIDAS.
export function spinBoost(state, { burn = 0, lucky = false, hot = false, midas = false } = {}) {
    const spikes = (lucky ? LUCK.luckySpinMult : 1) * (hot ? LUCK.hotMachineMult : 1) * (midas ? BREW_FX.midasMult : 1);
    return spikes * (1 + bonus(state, "payout", burn));
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

const lerp = (a, b, t) => a + (b - a) * t;

// The designed difficulty of `level`, 0 (first spin) to 1 (hardest): a front-loaded trend with a sawtooth on
// top. Inside a chapter it climbs; the first level of the next chapter drops back below the last peak.
export function difficulty(level) {
    const { peakLevel, shape, chapter, tooth } = TIMING.curve;
    const trend = clamp((level - 1) / (peakLevel - 1), 0, 1) ** shape;
    const t = ((level - 1) % chapter) / (chapter - 1);
    return clamp(trend + tooth * (t - 0.5), 0, 1);
}

// The timing meter for a spin: width and speed follow difficulty(level), then the adaptive nudge from recent
// skill (missing widens and slows it, a perfect streak tightens it), then the zone bonus.
export function meterSpec(level, skill, zoneBonus = 0, rand = Math.random) {
    const { zone, speed, adaptStrength, skillTarget, perfectRatio } = TIMING;
    const d = difficulty(level);
    const adapt = (skillTarget - skill) * adaptStrength;
    const width = clamp(lerp(zone.base, zone.hard, d) * (1 + adapt), zone.min, zone.max) * (1 + zoneBonus);
    const sweep = clamp(lerp(speed.base, speed.hard, d) * (1 - adapt * 0.5), speed.min, speed.max);
    const margin = width / 2 + 0.04;
    const center = margin + rand() * (1 - margin * 2);
    return { center, width, perfect: width * perfectRatio, speed: sweep };
}

export function gradeAt(spec, p) {
    const d = Math.abs(p - spec.center);
    if (d <= spec.perfect / 2) return "perfect";
    if (d <= spec.width / 2) return "good";
    return "miss";
}

// Logarithmic XP: the first coins of a stake count most, every extra x10 adds the same flat amount.
export const xpForStake = (amount) => (amount > 0 ? LEVELS.xpScale * Math.log1p(amount / LEVELS.xpUnit) : 0);

export const spinXp = (bet, grade) => xpForStake(bet) * TIMING.grades[grade].xp;

export const sellXp = (coins) => xpForStake(coins) * LEVELS.sellXp;

// A level costs a growing number of GOOD spins at that level's top non-VIP bet.
export function xpToNext(level) {
    const spins = LEVELS.spinsBase * LEVELS.spinsGrowth ** (level - 1);
    return Math.round(spins * spinXp(betCap(level), "good"));
}

// Round to 2 significant digits: 1,280 -> 1,300.
const nice = (x) => {
    const unit = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1);
    return Math.round(x / unit) * unit;
};

// The highest bet `level` allows: doubling from BET.first each level, up to BET.max.
export const betCap = (level) => Math.min(BET.max, nice(BET.first * BET.growth ** (Math.max(1, level) - 1)));

export const maxBet = (state) => betCap(state.level);

// Any typed amount becomes a whole bet between 0 and the cap.
export const clampBet = (state, amount) => clamp(Math.floor(Number.isFinite(amount) ? amount : 0), 0, maxBet(state));

// The -/+ buttons: the next BET.steps stop below or above `bet` (the cap itself is the top stop).
export function stepBet(state, bet, delta) {
    const cap = maxBet(state);
    const stops = [...new Set([...BET.steps.filter((x) => x < cap), cap])];
    const next = delta > 0 ? stops.find((x) => x > bet) : stops.findLast((x) => x < bet);
    return next ?? bet;
}

// Typed bets: "2500", "2,500", "2.5K", "1M". Returns NaN when it isn't a number.
export function parseBet(text) {
    const m = String(text).trim().toUpperCase().replace(/[,\s]/g, "").match(/^(\d+(?:\.\d+)?)([KM]?)$/);
    if (!m) return NaN;
    return Math.floor(Number(m[1]) * { "": 1, K: 1e3, M: 1e6 }[m[2]]);
}

// Auto spin is SPINNY's job: it works while SPINNY is on the team.
export const canAutoSpin = (state) => state.pets.team.includes("spinny");

export function unlocksAt(level) {
    const list = [];
    if (betCap(level) > betCap(level - 1)) list.push(`BET ${formatNumber(betCap(level))}`);
    UNLOCKS.filter((u) => u.level === level).forEach((u) => list.push(u.name));
    FARM.zones.filter((z) => z.level === level && level > 1).forEach((z) => list.push(`${z.name} TRIPS`));
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

export function upgradeValue(kind, lv) {
    const { base, step, compound } = MINE.upgrades[kind];
    return Math.round((base + step * lv) * compound ** lv);
}

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

// BOTTOMLESS FLASK: while it runs the cart takes any amount. cartCap stays the cart's size (the market measures
// supply in carts); cartLimit is how much it holds right now.
const bottomless = (state, now = Date.now()) => (state.buffs.bottomless ?? 0) > now;
export const cartLimit = (state, now = Date.now()) => (bottomless(state, now) ? Infinity : cartCap(state));

export const orePrice = (state) => MINE.orePrice * (1 + bonus(state, "sell"));

// state.ore is the cart at time state.mineAt; anything later is derived, never ticked.
export function oreAt(state, now = Date.now()) {
    const span = Math.max(0, now - state.mineAt);
    const rushed = clamp(state.buffs.goldRush - state.mineAt, 0, span);
    const mined = (orePerSecond(state) * (rushed * LUCK.goldRushMult + span - rushed)) / 1000;
    // Ore piled past the cart's size during BOTTOMLESS stays; the drill just can't add more until it is sold.
    const limit = Math.max(cartLimit(state, now), state.ore);
    return Math.min(limit, state.ore + (state.ore >= cartCap(state) && !bottomless(state, now) ? 0 : mined));
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
    state.ore = Math.min(Math.max(cartLimit(state), state.ore), state.ore + amount);
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
