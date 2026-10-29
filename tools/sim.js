// Headless simulation on top of src/core: slot return (Monte Carlo) and a simple bot that plays the game on a
// virtual clock. Used by tools/balance-report.js and by the balance tests, so both read the same numbers.
// Everything is seeded: the same seed always gives the same run.

import { BET, MINE, TIMING, LUCK, GEAR, GEAR_MAX, GEAR_STARS, VIP, RELICS } from "../src/core/config.js";
import * as econ from "../src/core/economy.js";
import * as luck from "../src/core/luck.js";
import * as market from "../src/core/market.js";
import { freshState } from "../src/core/save.js";
import { seeded } from "../src/core/farming.js";

// The core reads Date.now() for timestamps (ore, buffs). The bot runs on its own clock instead.
export function withClock(fn) {
    const real = Date.now;
    const clock = { now: 1_700_000_000_000 };
    Date.now = () => clock.now;
    try {
        return fn(clock);
    } finally {
        Date.now = real;
    }
}

// A standard normal draw from a uniform rng (Box-Muller).
const gauss = (rand) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

// ---- slot return ----

// Average win / bet over `spins` spins at a fixed grade and heat for `state`'s bonuses (stars included,
// lucky/hot/midas spikes left out: they are short and the guide lists them separately).
export function slotReturn(state, { grade = "miss", heat = 0, burn = 0, spins = 200_000, seed = 1 } = {}) {
    const rand = seeded(seed);
    const boost = econ.spinBoost(state, { burn });
    let paid = 0;
    for (let i = 0; i < spins; i++) {
        const stars = econ.rollStars(grade, 1, rand);
        const outcome = econ.evaluateSpin(econ.placeStars(econ.rollReels(rand), stars, rand));
        paid += econ.payout(1000, outcome, grade, heat, boost);
    }
    return paid / (spins * 1000);
}

// The strongest build the game allows: every gear piece at 5 stars (all sets on), the top VIP tier, the best
// slot pets on a full team and three legendary relics rolled with max payout.
export function maxBuild() {
    const state = freshState(0);
    state.gear = Object.fromEntries(GEAR.map((g) => [g.id, GEAR_MAX + GEAR_STARS]));
    state.burned = VIP[VIP.length - 1].at;
    state.pets.owned = ["rock", "digit6", "berry", "maneki"];
    state.pets.team = ["rock", "digit6", "berry"];
    state.pets.slots = 3;
    const top = RELICS.stats.find((s) => s.stat === "payout").max * RELICS.rarities[2].mult;
    state.relics.list = [0, 1, 2].map((i) => ({ uid: `r${i}`, rarity: "legendary", noun: "IDOL", stats: [{ stat: "payout", per: top }] }));
    state.relics.equipped = ["r0", "r1", "r2"];
    return state;
}

// ---- the bot ----

// Player archetypes: timing error (in meter widths, scaled by sweep speed), and share of time on the slot.
export const PLAYERS = {
    casual: { aim: 0.16, slotShare: 0.6, tapsPerSec: 3 },
    skilled: { aim: 0.07, slotShare: 0.6, tapsPerSec: 3.5 },
};

const SPIN_SECONDS = 3;

// One stop of the timing meter: the player aims at the center and lands off by their error x the sweep speed.
function stopMeter(spec, player, rand) {
    const err = Math.abs(gauss(rand) * player.aim * spec.speed);
    if (err <= spec.perfect / 2) return "perfect";
    if (err <= spec.width / 2) return "good";
    return "miss";
}

// The bot's bet: the biggest button stop under the cap it can lose 25 times in a row.
function chooseBet(state) {
    state.bet = BET.steps.findLast((x) => x <= econ.maxBet(state) && x * 25 <= state.coins) ?? 0;
    return state.bet;
}

// Buy the mine upgrade whose cost is lowest, while it costs under a fifth of the wallet.
function shop(state) {
    const kinds = Object.keys(MINE.upgrades);
    const cheapest = kinds.reduce((a, b) => (econ.upgradeCost(b, state.upgrades[b]) < econ.upgradeCost(a, state.upgrades[a]) ? b : a));
    const cost = econ.upgradeCost(cheapest, state.upgrades[cheapest]);
    if (cost * 5 > state.coins) return;
    econ.settleOre(state);
    state.coins -= cost;
    state.upgrades[cheapest]++;
}

function openChest(state, boost, rand) {
    const rarity = luck.openRarity(state, boost, rand);
    const reward = LUCK.rewards[rarity.id][Math.floor(rand() * LUCK.rewards[rarity.id].length)];
    return luck.applyReward(state, reward);
}

// Play `minutes` of game time. Returns per-level timings and where the coins came from.
export function playSession({ player = PLAYERS.casual, minutes = 240, seed = 1 } = {}) {
    return withClock((clock) => {
        const rand = seeded(seed);
        const state = freshState(clock.now);
        const reachedAt = { 1: 0 };
        const spinsAt = {};
        const income = { slot: 0, mine: 0, chest: 0 };
        const grades = { perfect: 0, good: 0, miss: 0 };
        const gradesByLevel = {};
        const end = clock.now + minutes * 60_000;
        const start = clock.now;
        const levelUp = (levels) => levels.forEach((l) => (reachedAt[l.level] = (clock.now - start) / 60_000));

        while (clock.now < end) {
            market.settle(state, clock.now, rand);
            if (rand() < player.slotShare) {
                const bet = chooseBet(state);
                const grade = stopMeter(econ.meterSpec(state.level, state.skill, 0, rand), player, rand);
                const lucky = bet > 0 && rand() < LUCK.luckySpinChance;
                const stars = bet ? econ.rollStars(grade, 1, rand) : 0;
                const outcome = econ.evaluateSpin(econ.placeStars(econ.rollReels(rand), stars, rand));
                const win = econ.payout(bet, outcome, grade, state.heat, econ.spinBoost(state, { burn: econ.burnApplied(state.burned, grade), lucky }));
                state.coins += win - bet;
                state.burned += bet;
                luck.trackBet(state, bet);
                income.slot += win - bet;
                if (bet) state.heat = econ.nextHeat(state.heat, grade);
                state.skill = econ.nextSkill(state.skill, grade);
                grades[grade]++;
                const g = (gradesByLevel[state.level] ??= { perfect: 0, good: 0, miss: 0 });
                g[grade]++;
                spinsAt[state.level] = (spinsAt[state.level] ?? 0) + 1;
                levelUp(econ.gainXp(state, econ.spinXp(bet, grade)));
                if (bet && rand() < LUCK.chestPerSpin) {
                    const before = state.coins;
                    levelUp(openChest(state, 0, rand).levels);
                    income.chest += state.coins - before;
                }
                clock.now += SPIN_SECONDS * 1000;
            } else {
                const taps = Math.round(player.tapsPerSec * SPIN_SECONDS);
                for (let i = 0; i < taps; i++) {
                    const lucky = rand() < MINE.luckyChance;
                    econ.addOre(state, econ.tapPower(state) * (lucky ? MINE.luckyMult : 1));
                }
                clock.now += SPIN_SECONDS * 1000;
            }
            // Sell a nearly full cart, spread out like a player who watches the market bar.
            econ.settleOre(state);
            if (state.ore >= econ.cartCap(state) * 0.8) {
                const amount = Math.floor(state.ore);
                const mult = market.sell(state, amount);
                const coins = Math.round(amount * econ.orePrice(state) * mult);
                state.ore -= amount;
                state.coins += coins;
                income.mine += coins;
                levelUp(econ.gainXp(state, econ.sellXp(coins)));
            }
            shop(state);
        }
        return { state, reachedAt, spinsAt, income, grades, gradesByLevel };
    });
}

// Run `runs` bots and take the median minute each level was reached (levels fewer than half reached are cut).
export function levelTimeline({ player, minutes, runs = 40, seed = 1 }) {
    const sessions = Array.from({ length: runs }, (_, i) => playSession({ player, minutes, seed: seed + i * 7919 }));
    const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const levels = [];
    for (let level = 2; ; level++) {
        const times = sessions.map((s) => s.reachedAt[level]).filter((t) => t !== undefined);
        if (times.length < runs / 2) break;
        levels.push({ level, minute: median(times) });
    }
    const hitRate = {};
    for (const s of sessions) {
        for (const [lv, g] of Object.entries(s.gradesByLevel)) {
            const h = (hitRate[lv] ??= { hit: 0, all: 0 });
            h.hit += g.perfect + g.good;
            h.all += g.perfect + g.good + g.miss;
        }
    }
    const income = sessions.reduce((sum, s) => ({ slot: sum.slot + s.income.slot, mine: sum.mine + s.income.mine, chest: sum.chest + s.income.chest }), { slot: 0, mine: 0, chest: 0 });
    return { levels, hitRate, income, sessions };
}
