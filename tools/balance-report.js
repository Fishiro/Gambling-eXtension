// Balance report: `npm run report`. Prints the difficulty curve, the XP curve, slot return per build, the mine
// upgrade payback, bot playthroughs and the chest distribution, all computed from src/core.

import { TIMING, MINE, LUCK, SYMBOLS } from "../src/core/config.js";
import * as econ from "../src/core/economy.js";
import * as luck from "../src/core/luck.js";
import { rawBonus } from "../src/core/items.js";
import { freshState } from "../src/core/save.js";
import { seeded } from "../src/core/farming.js";
import { slotReturn, maxBuild, levelTimeline, PLAYERS } from "./sim.js";

const pad = (x, n) => String(x).padStart(n);
const bar = (x, width = 30) => "#".repeat(Math.round(Math.max(0, Math.min(1, x)) * width));
const fmt = econ.formatNumber;
const h = (title) => console.log(`\n== ${title} ==`);

h("DIFFICULTY CURVE (sawtooth, meter at skill = target)");
console.log(" LV  diff  zone   speed");
for (let lv = 1; lv <= 30; lv++) {
    const spec = econ.meterSpec(lv, TIMING.skillTarget, 0, () => 0.5);
    console.log(`${pad(lv, 3)}  ${econ.difficulty(lv).toFixed(2)}  ${spec.width.toFixed(3)}  ${spec.speed.toFixed(2)}  ${bar(econ.difficulty(lv))}`);
}

h("XP PER SPIN (logarithmic in the bet, GOOD timing)");
for (const bet of [1, 5, 100, 1000, 10_000, 100_000, 5_000_000]) console.log(`bet ${pad(fmt(bet), 6)}  ${pad(econ.spinXp(bet, "good").toFixed(1), 6)} xp`);

h("XP CURVE (spins at the level's max bet / at a 10x smaller bet, GOOD timing)");
console.log(" LV   xp to next   max bet   spins   at bet/10");
for (const lv of [1, 3, 5, 8, 10, 11, 12, 15, 20, 25, 30, 40]) {
    const bet = econ.betCap(lv);
    const need = econ.xpToNext(lv);
    const at = (b) => (need / econ.spinXp(b, "good")).toFixed(1);
    console.log(`${pad(lv, 3)}  ${pad(fmt(need), 11)}  ${pad(fmt(bet), 8)}  ${pad(at(bet), 6)}  ${pad(at(Math.max(1, bet / 10)), 9)}`);
}

h("LINE ODDS PER SPIN (easy lines slip half the time)");
const odds = econ.lineOdds();
for (const s of SYMBOLS) console.log(`${s.name.padEnd(7)} 3x ${(odds[s.id].triple * 100).toFixed(3)}%  2x ${(odds[s.id].pair * 100).toFixed(2)}%${s.easy ? "  (easy)" : ""}`);
const anyWin = SYMBOLS.reduce((sum, s) => sum + odds[s.id].triple + odds[s.id].pair, 0);
console.log(`any line: ${(anyWin * 100).toFixed(1)}% of spins`);

h("SLOT RETURN (win / bet, long run)");
const fresh = freshState(0);
const max = maxBuild();
const burnMax = econ.burnBonus(Infinity);
const rows = [
    ["new player, miss, no heat", fresh, { grade: "miss" }],
    ["good timing, heat 3", fresh, { grade: "good", heat: 3 }],
    ["skilled: perfect, heat 5, max burn", fresh, { grade: "perfect", heat: TIMING.heatMax, burn: burnMax }],
    ["MAX BUILD, miss, no heat", max, { grade: "miss" }],
    ["MAX BUILD, perfect, heat 5, max burn", max, { grade: "perfect", heat: TIMING.heatMax, burn: burnMax }],
];
for (const [label, state, opts] of rows) console.log(`${label.padEnd(40)} x${slotReturn(state, opts).toFixed(2)}`);
const raw = rawBonus(max, "payout") + burnMax;
console.log(`max build payout stat: raw +${Math.round(raw * 100)}% -> capped +${Math.round(econ.spinBoost(max, { burn: burnMax }) * 100 - 100)}%`);

h("MINE UPGRADES (cost, value, payback)");
console.log("kind   lv        cost        value    gain   payback");
for (const kind of Object.keys(MINE.upgrades)) {
    for (const lv of [0, 5, 10, 15, 20, 30]) {
        const cost = econ.upgradeCost(kind, lv);
        const gain = econ.upgradeValue(kind, lv + 1) - econ.upgradeValue(kind, lv);
        // pick: taps to repay at 1 coin/ore; drill: minutes of drilling; cart: just the size.
        const payback = kind === "pick" ? `${fmt(cost / gain)} taps` : kind === "drill" ? `${fmt(cost / gain)} min` : "-";
        console.log(`${kind.padEnd(5)} ${pad(lv, 3)} ${pad(fmt(cost), 11)} ${pad(fmt(econ.upgradeValue(kind, lv)), 12)} ${pad(fmt(gain), 7)}   ${payback}`);
    }
}

for (const [name, player] of Object.entries(PLAYERS)) {
    const minutes = 360;
    const run = levelTimeline({ player, minutes, runs: 30 });
    h(`BOT: ${name.toUpperCase()} PLAYER, ${minutes} MIN, 30 RUNS (median minute each level is reached)`);
    let prev = 0;
    console.log(" LV  minute  +min  hit rate");
    for (const { level, minute } of run.levels) {
        const hr = run.hitRate[level - 1];
        console.log(`${pad(level, 3)}  ${pad(minute.toFixed(1), 6)}  ${pad((minute - prev).toFixed(1), 5)}  ${hr ? `${Math.round((hr.hit / hr.all) * 100)}%` : "-"}`);
        prev = minute;
    }
    const { slot, mine, chest } = run.income;
    const total = Math.max(1, slot + mine + chest);
    console.log(`net income share: slot ${Math.round((slot / total) * 100)}%  mine ${Math.round((mine / total) * 100)}%  chests ${Math.round((chest / total) * 100)}%`);
}

h("CHESTS (100,000 opened, pity on)");
const rand = seeded(42);
const state = freshState(0);
const seen = Object.fromEntries(LUCK.rarities.map((r) => [r.id, 0]));
const longest = { epic: 0, legendary: 0 };
const since = { epic: 0, legendary: 0 };
for (let i = 0; i < 100_000; i++) {
    const r = luck.openRarity(state, 0, rand);
    seen[r.id]++;
    since.epic = luck.rarityIndex(r) >= 2 ? 0 : since.epic + 1;
    since.legendary = r.id === "legendary" ? 0 : since.legendary + 1;
    longest.epic = Math.max(longest.epic, since.epic);
    longest.legendary = Math.max(longest.legendary, since.legendary);
}
const weights = LUCK.rarities.reduce((sum, r) => sum + r.weight, 0);
for (const r of LUCK.rarities) console.log(`${r.name.padEnd(10)} ${pad((seen[r.id] / 1000).toFixed(2), 6)}%  (table ${((r.weight / weights) * 100).toFixed(1)}%)`);
console.log(`longest run without epic+: ${longest.epic} (pity ${LUCK.pity.epic}), without legendary: ${longest.legendary} (pity ${LUCK.pity.legendary})`);
