import { test } from "node:test";
import assert from "node:assert/strict";
import { TIMING, LEVELS, MINE, LUCK, BET_STEPS, STAT_CAPS, FARM, MARKET } from "../src/core/config.js";
import * as econ from "../src/core/economy.js";
import * as luck from "../src/core/luck.js";
import * as farming from "../src/core/farming.js";
import * as market from "../src/core/market.js";
import { softcap, bonus } from "../src/core/items.js";
import { freshState, restore, SAVE_VERSION } from "../src/core/save.js";
import { withClock } from "../tools/sim.js";

const always = (x) => () => x;

test("reels: triple, pair from the left, near miss, loss", () => {
    assert.equal(econ.evaluateSpin(["seven", "seven", "seven"]).kind, "triple");
    assert.equal(econ.evaluateSpin(["gem", "gem", "bell"]).kind, "pair");
    assert.equal(econ.evaluateSpin(["gem", "bell", "bell"]).kind, "near");
    assert.equal(econ.evaluateSpin(["gem", "bell", "cherry"]).kind, "lose");
    assert.equal(econ.evaluateSpin(["cosmic", "cosmic", "cosmic"]).kind, "cosmic");
    assert.equal(econ.payout(0, econ.evaluateSpin(["seven", "seven", "seven"]), "perfect", 5), 0);
});

test("softcap: unchanged below the knee, continuous, never reaches the cap", () => {
    const c = { knee: 0.25, cap: 0.5 };
    assert.equal(softcap(0.1, c), 0.1);
    assert.ok(Math.abs(softcap(0.25 + 1e-9, c) - 0.25) < 1e-6);
    let prev = 0;
    for (let raw = 0; raw < 50; raw += 0.25) {
        const v = softcap(raw, c);
        assert.ok(v >= prev && v < c.cap);
        prev = v;
    }
    for (const stat of Object.keys(STAT_CAPS)) assert.ok(STAT_CAPS[stat].knee < STAT_CAPS[stat].cap, stat);
});

test("payout stat takes burn through the cap", () => {
    const s = freshState(0);
    assert.equal(bonus(s, "payout", 0.1), 0.1);
    assert.ok(bonus(s, "payout", 10) < STAT_CAPS.payout.cap);
});

test("difficulty: sawtooth with rising peaks, from 0 to 1", () => {
    const { chapter } = TIMING.curve;
    assert.equal(econ.difficulty(1), 0);
    let lastPeak = -1;
    for (let lv = chapter; lv <= 40; lv += chapter) {
        const peak = econ.difficulty(lv);
        const next = econ.difficulty(lv + 1);
        assert.ok(peak >= lastPeak, `peak at LV${lv} must not drop`);
        if (peak < 1) assert.ok(next < peak, `LV${lv + 1} should open easier than the LV${lv} peak`);
        lastPeak = peak;
    }
    assert.equal(econ.difficulty(60), 1);
    for (let lv = 1; lv <= 60; lv++) assert.ok(econ.difficulty(lv) >= 0 && econ.difficulty(lv) <= 1);
});

test("meter: adaptive nudge stays inside its clamps", () => {
    const { zone, speed } = TIMING;
    for (const level of [1, 10, 30]) {
        for (const skill of [0, 0.5, 1]) {
            const spec = econ.meterSpec(level, skill, 0, always(0.5));
            assert.ok(spec.width >= zone.min - 1e-9 && spec.width <= zone.max + 1e-9);
            assert.ok(spec.speed >= speed.min - 1e-9 && spec.speed <= speed.max + 1e-9);
            assert.ok(spec.center - spec.width / 2 > 0 && spec.center + spec.width / 2 < 1);
        }
    }
    // Missing a lot makes it easier; a perfect streak makes it harder.
    assert.ok(econ.meterSpec(15, 0, 0, always(0.5)).width > econ.meterSpec(15, 1, 0, always(0.5)).width);
});

test("xp is logarithmic: each x10 on the bet adds the same flat amount", () => {
    const step = (b) => econ.xpForStake(b * 10) - econ.xpForStake(b);
    for (const bet of [1_000, 10_000, 1_000_000]) assert.ok(Math.abs(step(bet) - LEVELS.xpScale * Math.LN10) < 0.5, `x10 from ${bet}`);
    assert.ok(econ.spinXp(5_000_000, "good") / econ.spinXp(10_000, "good") < 2, "500x the bet must not give 500x the XP");
    assert.equal(econ.spinXp(0, "perfect"), 0);
});

test("xp curve: always rising, no level in a handful of spins, no wall", () => {
    for (let lv = 1; lv < 60; lv++) {
        const ratio = econ.xpToNext(lv + 1) / econ.xpToNext(lv);
        assert.ok(ratio > 1 && ratio < 2, `LV${lv} ratio ${ratio.toFixed(2)}`);
        // Even a perfect spin at the biggest bet this level allows (top VIP) is a small slice of a level.
        const topBet = BET_STEPS[econ.maxBet({ level: lv, burned: Infinity })];
        assert.ok(econ.spinXp(topBet, "perfect") < econ.xpToNext(lv) / 4, `LV${lv}: one max bet is too much XP`);
    }
    const capBet = BET_STEPS[econ.maxBet({ level: 30, burned: 0 })];
    assert.ok(econ.xpToNext(30) / econ.spinXp(capBet, "good") < 200, "LV30 should take a couple hundred spins, not thousands");
});

test("save: v2 xp keeps the share of the level already earned", () => {
    const s = restore({ version: 2, coins: 10, level: 12, xp: 32_131 / 2 });
    assert.ok(Math.abs(s.xp / econ.xpToNext(12) - 0.5) < 0.01);
});

test("unlocks: something new at every level from 2 to 11", () => {
    for (let lv = 2; lv <= 11; lv++) assert.ok(econ.unlocksAt(lv).length > 0, `LV${lv} unlocks nothing`);
});

test("mine upgrades: value always grows, payback grows slowly", () => {
    for (const kind of Object.keys(MINE.upgrades)) {
        for (let lv = 0; lv < 40; lv++) {
            assert.ok(econ.upgradeValue(kind, lv + 1) > econ.upgradeValue(kind, lv), `${kind} LV${lv}`);
            const payback = (l) => econ.upgradeCost(kind, l) / (econ.upgradeValue(kind, l + 1) - econ.upgradeValue(kind, l));
            if (lv > 0) assert.ok(payback(lv) / payback(lv - 1) < 1.6, `${kind} LV${lv} payback jumps`);
        }
    }
});

test("ore: the cart never overfills from the drill, settling is idempotent", () =>
    withClock((clock) => {
        const s = freshState(clock.now);
        clock.now += 24 * 3600 * 1000;
        assert.equal(econ.oreAt(s), econ.cartCap(s));
        econ.settleOre(s);
        const once = s.ore;
        econ.settleOre(s);
        assert.equal(s.ore, once);
    }));

test("chests: pity forces an epic and a legendary on schedule", () => {
    const s = freshState(0);
    const unlucky = always(0); // always rolls common
    const got = Array.from({ length: LUCK.pity.legendary }, () => luck.openRarity(s, 0, unlucky).id);
    assert.equal(got[LUCK.pity.epic - 1], "epic");
    assert.ok(got.slice(0, LUCK.pity.epic - 1).every((id) => id === "common"));
    assert.equal(got[LUCK.pity.legendary - 1], "legendary");
    assert.equal(s.pity.legendary, 0);
});

test("chests: a sure-legendary boost stays sure", () => {
    assert.equal(luck.rollRarity(LUCK.legendaryBoost, always(0)).id, "legendary");
});

test("junk scraps into coins and stays in the collection", () => {
    const s = freshState(0);
    s.bag.pebble = 4;
    s.bag.iron = 3;
    assert.equal(luck.scrapValue(s, "iron"), 0);
    const coins = luck.scrap(s, "pebble");
    assert.ok(coins > 0);
    assert.equal(s.coins, 100 + coins);
    assert.equal(s.bag.pebble, 0);
    assert.ok("pebble" in s.bag);
    assert.equal(luck.scrap(s, "pebble"), 0);
});

test("expeditions: same seed, same loot; stances trade finds for luck", () => {
    const run = (stance) => {
        const s = freshState(0);
        farming.startTrip(s, "forest", 2, [], stance, 0);
        s.trip.seed = 1234;
        return farming.collectTrip(s, 10 * 3600 * 1000);
    };
    assert.deepEqual(run("steady").loot, run("steady").loot);
    const plan = FARM.trips[2];
    const s = freshState(0);
    const [steady, forage, delve] = FARM.stances;
    assert.ok(farming.tripRolls(s, plan, 0, 1, forage) > farming.tripRolls(s, plan, 0, 1, steady));
    assert.ok(farming.tripRolls(s, plan, 0, 1, delve) < farming.tripRolls(s, plan, 0, 1, steady));
    assert.ok(farming.tripLuck(plan, delve) > farming.tripLuck(plan, steady));
    // An old trip without a stance still collects.
    const old = freshState(0);
    old.trip = { zone: "forest", trip: 0, at: 0, seed: 5, pets: [] };
    assert.ok(farming.collectTrip(old, 3600 * 1000));
});

test("market: dumping sinks the price, a light sell does not", () => {
    assert.equal(market.glutAt(MARKET.freeCarts), 0);
    const ticks = (sold) => {
        const s = freshState(0);
        const rand = (() => {
            let x = 0;
            return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
        })();
        for (let i = 0; i < 10; i++) {
            s.market.sold = sold * econ.cartCap(s);
            market.step(s.market, econ.cartCap(s), rand);
        }
        return market.price(s.market);
    };
    assert.ok(ticks(5) < ticks(0.3) * 0.5);
});

test("save: fresh state survives a round trip", () => {
    const s = freshState(1000);
    const back = restore(JSON.parse(JSON.stringify(s)), 1000);
    assert.deepEqual(back, s);
});

test("save: old saves migrate (pet team, SPINNY gift, split unlocks)", () => {
    const old = { coins: 50, level: 4, pets: { owned: ["cat"], active: "cat" }, unlocked: ["market", "endgame"] };
    const s = restore(old);
    assert.equal(s.version, SAVE_VERSION);
    assert.deepEqual(s.pets.team, ["cat"]);
    assert.ok(s.pets.owned.includes("spinny"));
    assert.equal(s.pets.active, undefined);
    assert.deepEqual(s.unlocked, ["market", "vault", "relics"]);
});

test("save: broken or hostile data is rejected or forced into range", () => {
    assert.equal(restore(null), null);
    assert.equal(restore({ coins: "lots", level: 3 }), null);
    assert.equal(restore({ coins: Infinity, level: 3 }), null);
    const s = restore({
        coins: -5,
        level: 0.5,
        betIndex: 999,
        heat: 40,
        skill: 7,
        gems: NaN,
        tab: "<img>",
        bag: { stone: 5, hacked: 1e9, iron: "x" },
        pets: { owned: ["cat", "dragon"], team: ["cat", "dragon", "rock"], slots: 99 },
        relics: { list: [{ uid: "a", stats: [] }, "junk"], equipped: ["a", "nope", null] },
        skins: { owned: ["casino"], active: "office" },
        upgrades: { pick: -3, drill: "1" },
        market: { price: Infinity },
        mineAt: 9e15,
    }, 5000);
    assert.equal(s.coins, 0);
    assert.equal(s.level, 1);
    assert.equal(s.betIndex, BET_STEPS.length - 1);
    assert.equal(s.heat, TIMING.heatMax);
    assert.equal(s.skill, 1);
    assert.equal(s.gems, 0);
    assert.equal(s.tab, "slot");
    assert.deepEqual(s.bag, { stone: 5 });
    assert.deepEqual(s.pets.owned, ["cat"]);
    assert.deepEqual(s.pets.team, ["cat"]);
    assert.equal(s.pets.slots, 3);
    assert.deepEqual(s.relics.equipped, ["a", null, null]);
    assert.equal(s.relics.list.length, 1);
    assert.equal(s.skins.active, "miner");
    assert.deepEqual(s.upgrades, { pick: 0, drill: 0, cart: 0 });
    assert.equal(s.market.price, 1);
    assert.equal(s.mineAt, 5000);
});
