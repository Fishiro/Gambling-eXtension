import { test } from "node:test";
import assert from "node:assert/strict";
import { TIMING, LEVELS, MINE, LUCK, BET, STAT_CAPS, FARM, MARKET, SYMBOLS, PET_REEL, GEAR, GEAR_MAX, GEAR_GROWTH, STAR_CHANCE, STAR_COST, CRAFT_FEE, BREWS, ITEMS } from "../src/core/config.js";
import { recordGroups } from "../src/core/records.js";
import * as econ from "../src/core/economy.js";
import * as luck from "../src/core/luck.js";
import * as farming from "../src/core/farming.js";
import * as market from "../src/core/market.js";
import { softcap, bonus, upgrade, upgradeChance, gearLevel, gearCost, brewCost, spend, usesOf, brewNeed } from "../src/core/items.js";
import { freshState, restore, SAVE_VERSION } from "../src/core/save.js";
import { withClock } from "../tools/sim.js";
import { seeded } from "../src/core/farming.js";

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
        const topBet = econ.betCap(lv);
        assert.ok(econ.spinXp(topBet, "perfect") < econ.xpToNext(lv) / 4, `LV${lv}: one max bet is too much XP`);
    }
    const capBet = econ.betCap(30);
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
        bet: 5e9,
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
    assert.equal(s.bet, econ.betCap(1));
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

test("bet: the cap doubles by level up to 1M and nothing raises it further", () => {
    assert.equal(econ.betCap(1), BET.first);
    for (let lv = 2; lv <= 80; lv++) assert.ok(econ.betCap(lv) >= econ.betCap(lv - 1) && econ.betCap(lv) <= BET.max);
    assert.equal(econ.betCap(19), BET.max);
    const vip = { level: 50, burned: 1e15 };
    assert.equal(econ.maxBet(vip), BET.max);
    assert.equal(econ.clampBet(vip, 5e9), BET.max);
});

test("bet: typed amounts parse, clamp and step", () => {
    assert.equal(econ.parseBet("2,500"), 2500);
    assert.equal(econ.parseBet("2.5k"), 2500);
    assert.equal(econ.parseBet(" 1M "), 1_000_000);
    assert.ok(Number.isNaN(econ.parseBet("lots")));
    assert.ok(Number.isNaN(econ.parseBet("-5")));
    const s = { level: 9 }; // cap 1,300
    assert.equal(econ.clampBet(s, 777), 777);
    assert.equal(econ.clampBet(s, 9999), 1300);
    assert.equal(econ.stepBet(s, 777, 1), 1000);
    assert.equal(econ.stepBet(s, 1000, 1), 1300);
    assert.equal(econ.stepBet(s, 1300, 1), 1300);
    assert.equal(econ.stepBet(s, 777, -1), 500);
    assert.equal(econ.stepBet(s, 0, -1), 0);
});

test("easy lines land half as often, the rest keep their odds", () => {
    const rand = seeded(11);
    const n = 400_000;
    const hits = {};
    for (let i = 0; i < n; i++) {
        const o = econ.evaluateSpin(econ.rollReels(rand));
        if (o.mult) hits[o.symbol] = (hits[o.symbol] ?? 0) + 1;
    }
    const odds = econ.lineOdds();
    for (const sym of SYMBOLS) {
        const expected = odds[sym.id].triple + odds[sym.id].pair;
        const seen = (hits[sym.id] ?? 0) / n;
        assert.ok(Math.abs(seen - expected) < expected * 0.08 + 1e-4, `${sym.id}: ${seen} vs ${expected}`);
    }
    const total = SYMBOLS.reduce((sum, x) => sum + x.weight, 0);
    const p = SYMBOLS[0].weight / total;
    assert.ok(Math.abs(odds.cherry.pair - p * p * (1 - p) * 0.5) < 1e-12);
});

test("pets raise odds, never force: SEVEN tops 7-7-7 at 2.5%, bends never make a jackpot", () => {
    const rand = seeded(5);
    const n = 400_000;
    let jackpots = 0;
    let bentJackpots = 0;
    for (let i = 0; i < n; i++) {
        const seven = econ.petBend(econ.rollReels(rand), { seven: true }, rand).roll;
        if (seven.every((x) => x === "seven")) jackpots++;
        const bent = econ.petBend(econ.rollReels(rand), { bend: true }, rand);
        if (bent.bent && bent.roll.every((x) => x === "seven")) bentJackpots++;
    }
    assert.ok(Math.abs(jackpots / n - PET_REEL.jackpotMax) < 0.0015, `7-7-7 ${(jackpots / n) * 100}%`);
    assert.ok(jackpots / n <= PET_REEL.jackpotMax + 0.0015);
    assert.equal(bentJackpots, 0);
    // Bending only touches dead rolls.
    assert.deepEqual(econ.petBend(["gem", "gem", "bell"], { bend: true }, () => 0).roll, ["gem", "gem", "bell"]);
});

test("save: v3 bet step index becomes a bet amount", () => {
    const s = restore({ version: 3, coins: 10, level: 15, betIndex: 13 });
    assert.equal(s.bet, 10_000);
    assert.equal(s.betIndex, undefined);
    assert.equal(restore({ version: 3, coins: 10, level: 2, betIndex: 19 }).bet, econ.betCap(2));
});

test("stats: every record group renders for a fresh and an old save", () => {
    for (const s of [freshState(0), restore({ coins: 5, level: 3 })]) {
        const groups = recordGroups(s);
        assert.ok(groups.length >= 4);
        for (const g of groups) for (const [label, value] of g.rows) assert.ok(label && value !== undefined && !String(value).includes("NaN"), `${g.title} ${label}`);
    }
});

test("chests: a bet spin drops one chest 10% of the time, whatever the bet", () => {
    const lose = econ.evaluateSpin(["gem", "bell", "cherry"]);
    const triple = econ.evaluateSpin(["seven", "seven", "seven"]);
    for (const bet of [1, 1000, 1_000_000]) {
        const rand = seeded(bet);
        let drops = 0;
        for (let i = 0; i < 100_000; i++) if (econ.spinChest(bet, lose, rand) !== null) drops++;
        assert.ok(Math.abs(drops / 100_000 - LUCK.chestPerSpin) < 0.005, `bet ${bet}: ${drops / 1000}%`);
    }
    assert.equal(econ.spinChest(0, triple, () => 0), null, "practice spins drop nothing");
    assert.equal(econ.spinChest(5, triple, () => 0.99), null, "a jackpot is not a free chest");
    assert.equal(econ.spinChest(5, triple, () => 0), LUCK.tripleBoost);
    // Burn past the top tier is just maxed: no more chests from betting.
    assert.equal(econ.burnTier(1e12).toNext, 0);
});

test("chest coins follow the level, never the bet", () => {
    const a = freshState(0);
    const b = freshState(0);
    a.level = b.level = 20;
    b.bet = 1_000_000;
    b.burned = 1e12;
    assert.equal(luck.rewardUnit(a), LUCK.coinPerLevel * 20);
    assert.equal(luck.rewardUnit(b), luck.rewardUnit(a));
});

test("gear: LV1-5 always work, stars succeed at STAR_CHANCE, a failure cracks a star off", () => {
    assert.deepEqual(STAR_CHANCE, [...STAR_CHANCE].sort((x, y) => y - x), "star odds must only fall");
    assert.equal(STAR_CHANCE[0], 0.8);
    assert.equal(STAR_CHANCE.at(-1), 0.15);
    const gear = GEAR[0];
    const rich = () => {
        const s = freshState(0);
        s.coins = 1e12;
        s.gems = 1e6;
        for (const cost of STAR_COST) for (const id of Object.keys(cost)) if (!["coins", "gems"].includes(id)) s.bag[id] = 1e6;
        s.gear[gear.id] = GEAR_MAX;
        return s;
    };
    const s = rich();
    assert.equal(upgradeChance(s, gear), STAR_CHANCE[0]);
    const coins = s.coins;
    assert.equal(upgrade(s, gear, () => 0.99), "fail");
    assert.equal(gearLevel(s, gear.id), GEAR_MAX, "a failed first star can't drop below LV5");
    assert.ok(s.coins < coins, "a failure still costs");
    assert.equal(upgrade(s, gear, () => 0), "up");
    assert.equal(upgrade(s, gear, () => 0), "up");
    assert.equal(upgradeChance(s, gear), STAR_CHANCE[2]);
    assert.equal(upgrade(s, gear, () => 0.99), "crack");
    assert.equal(gearLevel(s, gear.id), GEAR_MAX + 1, "a failed third star cracks the second one off");
    // Over many tries each star lands at its odds.
    const rand = seeded(9);
    for (let star = 0; star < STAR_CHANCE.length; star++) {
        let ok = 0;
        const n = 20_000;
        for (let i = 0; i < n; i++) {
            const t = rich();
            t.gear[gear.id] = GEAR_MAX + star;
            if (upgrade(t, gear, rand) === "up") ok++;
        }
        assert.ok(Math.abs(ok / n - STAR_CHANCE[star]) < 0.015, `star ${star + 1}: ${ok / n}`);
    }
    const fresh = freshState(0);
    fresh.bag.stone = 100;
    fresh.coins = 1e6;
    assert.equal(upgrade(fresh, gear, () => 0.99), "up", "plain levels never fail");
});

test("live ore/min: taps in the window count per minute, older ones drop out", () => {
    const log = [[0, 10], [1000, 10], [2500, 10]];
    assert.equal(econ.tapRate(log, 2600, 3000), 600); // 30 ore in 3 s
    assert.equal(econ.tapRate(log, 3500, 3000), 400); // the first tap left the window
    assert.equal(econ.tapRate([], 1000, 3000), 0);
    assert.equal(econ.tapRate(log, 10_000, 3000), 0);
});

test("every craft costs coins: gear levels by GEAR_GROWTH, brews by rarity", () => {
    for (const gear of GEAR) {
        for (let lv = 0; lv < GEAR_MAX; lv++) assert.equal(gearCost(gear, lv).coins, Math.ceil(CRAFT_FEE.gear * GEAR_GROWTH ** lv), `${gear.id} LV${lv}`);
        assert.ok(gearCost(gear, GEAR_MAX).coins > 0, "stars cost coins too");
    }
    for (const brew of BREWS) {
        const cost = brewCost(brew);
        assert.equal(cost.coins, CRAFT_FEE.brew[ITEMS[brew.id].rarity], brew.id);
        for (const [id, n] of Object.entries(brew.cost)) assert.equal(cost[id], n);
    }
    // Materials alone are not enough.
    const s = freshState(0);
    s.coins = 0;
    Object.assign(s.bag, BREWS[0].cost);
    assert.equal(spend(s, brewCost(BREWS[0])), false);
});

test("item uses: every recipe that needs an item is listed, junk keeps what brews need", () => {
    for (const id of Object.keys(ITEMS)) {
        const uses = usesOf(id);
        for (const b of BREWS) if (b.cost[id]) assert.ok(uses.some((u) => u.brew === b), `${id} -> ${b.id}`);
        for (const g of GEAR) if (g.cost[id]) assert.ok(uses.some((u) => u.kind === "gear" && u.name === g.name), `${id} -> ${g.id}`);
    }
    assert.deepEqual(usesOf("duck"), []);
    assert.equal(brewNeed("pebble"), 6);
    assert.ok(usesOf("seed").some((u) => u.kind === "plant"));
    const s = freshState(0);
    s.level = 4;
    s.bag.pebble = 10;
    const one = luck.scrap(s, "pebble", 1);
    assert.equal(s.bag.pebble, 9);
    assert.equal(one, luck.scrapValue(s, "pebble"));
    luck.scrap(s, "pebble", 10 - 1 - brewNeed("pebble"));
    assert.equal(s.bag.pebble, brewNeed("pebble"), "scrap extra leaves exactly what the brew needs");
});

test("mining xp: a market minute counts as one sale, and it stays a trickle", () => {
    const spam = freshState(0);
    let spamXp = 0;
    for (let i = 0; i < 20; i++) spamXp += market.sellXpFor(spam, 50);
    const once = freshState(0);
    const onceXp = market.sellXpFor(once, 1000);
    assert.ok(Math.abs(spamXp - onceXp) < 1e-9, `20 small sales ${spamXp} vs one big ${onceXp}`);
    // A new minute starts a new sale.
    market.step(spam.market, econ.cartCap(spam), () => 0.5);
    assert.ok(market.sellXpFor(spam, 1000) > onceXp * 0.99);
    // A whole minute of selling, a big cart at the market's top price, is worth under two spins of XP (a player
    // spins about twenty times a minute), so the mine only trickles XP.
    for (const level of [5, 12, 20, 30]) {
        const coins = econ.upgradeValue("cart", level) * MARKET.cap;
        const spin = econ.spinXp(econ.betCap(level), "good");
        assert.ok(econ.sellXp(coins) < spin * 2, `LV${level}: a minute of selling = ${econ.sellXp(coins).toFixed(1)} XP vs a spin ${spin.toFixed(1)}`);
    }
});
