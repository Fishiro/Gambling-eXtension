import { test } from "node:test";
import assert from "node:assert/strict";
import { TIMING, LUCK } from "../src/core/config.js";
import * as econ from "../src/core/economy.js";
import * as luck from "../src/core/luck.js";
import { freshState } from "../src/core/save.js";
import { seeded } from "../src/core/farming.js";
import { slotReturn, maxBuild, levelTimeline, PLAYERS } from "../tools/sim.js";

// Acceptance thresholds from docs/game-design.md (section 9). A tuning change that breaks one of these needs a
// design decision, not a quiet number bump.

const burnMax = econ.burnBonus(Infinity);
const spins = 120_000;

test("slot return: the house wins against no skill, skill pays, nothing prints money", () => {
    const fresh = freshState(0);
    const max = maxBuild();
    const base = slotReturn(fresh, { grade: "miss", spins });
    const skilled = slotReturn(fresh, { grade: "perfect", heat: TIMING.heatMax, burn: burnMax, spins });
    const maxIdle = slotReturn(max, { grade: "miss", spins });
    const maxFlawless = slotReturn(max, { grade: "perfect", heat: TIMING.heatMax, burn: burnMax, spins });
    assert.ok(base > 0.5 && base < 0.7, `base return x${base.toFixed(2)}`);
    assert.ok(skilled > 1.15, `skill should pay: x${skilled.toFixed(2)}`);
    assert.ok(maxIdle < 1, `max build with no skill must not print money: x${maxIdle.toFixed(2)}`);
    assert.ok(maxFlawless < 1.7, `max build flawless: x${maxFlawless.toFixed(2)}`);
});

test("chests: the table holds, and pity caps every dry streak", () => {
    const rand = seeded(7);
    const s = freshState(0);
    const n = 50_000;
    const seen = { common: 0, rare: 0, epic: 0, legendary: 0 };
    let dryEpic = 0;
    let dryLegend = 0;
    let worstEpic = 0;
    let worstLegend = 0;
    for (let i = 0; i < n; i++) {
        const r = luck.openRarity(s, 0, rand);
        seen[r.id]++;
        dryEpic = luck.rarityIndex(r) >= 2 ? 0 : dryEpic + 1;
        dryLegend = r.id === "legendary" ? 0 : dryLegend + 1;
        worstEpic = Math.max(worstEpic, dryEpic);
        worstLegend = Math.max(worstLegend, dryLegend);
    }
    assert.ok(worstEpic < LUCK.pity.epic && worstLegend < LUCK.pity.legendary);
    // Pity lifts the rare tiers a little, never a lot.
    const weights = LUCK.rarities.reduce((sum, r) => sum + r.weight, 0);
    for (const r of LUCK.rarities) {
        const share = (seen[r.id] / n) * 100;
        const table = (r.weight / weights) * 100;
        assert.ok(Math.abs(share - table) < Math.max(2.5, table * 0.5), `${r.id}: ${share.toFixed(1)}% vs table ${table.toFixed(1)}%`);
    }
});

for (const [name, player] of Object.entries(PLAYERS)) {
    test(`bot (${name}): steady progress, no spikes, mine and slot both matter`, () => {
        const run = levelTimeline({ player, minutes: 180, runs: 12, seed: 3 });
        const levels = run.levels;
        assert.ok(levels.length >= 15, `only reached LV${levels.at(-1)?.level}`);
        assert.ok(levels.find((l) => l.level === 10).minute < 30, "LV10 should come within half an hour of play");
        // A difficulty spike shows up as one level taking far longer than the ones just before it.
        const gaps = levels.map((l, i) => l.minute - (levels[i - 1]?.minute ?? 0));
        for (let i = 4; i < gaps.length; i++) {
            const recent = Math.max(...gaps.slice(i - 3, i));
            assert.ok(gaps[i] < recent * 3, `LV${levels[i].level} took ${gaps[i].toFixed(1)} min after ${recent.toFixed(1)}`);
        }
        // The slot is a coin sink unless you time well; the mine and chests must carry the wallet.
        const { slot, mine, chest } = run.income;
        assert.ok(slot + mine + chest > 0, "the bot went broke overall");
        assert.ok(mine > 0, "the mine must earn");
        // The meter keeps every player in reach: nobody sinks below 1 in 10 hits.
        for (const [lv, h] of Object.entries(run.hitRate)) if (h.all > 100) assert.ok(h.hit / h.all > 0.1, `LV${lv} hit rate ${h.hit}/${h.all}`);
    });
}
