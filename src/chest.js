import { LUCK, COSMIC } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import * as luck from "./luck.js";
import { PALETTE, svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";
import * as modal from "./modal.js";
import { emit } from "./events.js";
import { toast } from "./toast.js";

const ROULETTE = [45, 45, 50, 55, 60, 70, 85, 100, 120, 150, 190, 240, 300];
// Rewards listed in the OPEN ALL toast before "+N MORE".
const TOAST_LINES = 4;
const linesHtml = (lines) => lines.map((l) => `<div>${svgIcon(l.icon, 2)}${l.text}</div>`).join("");

export function createChests({ onLevelUp, onOpened }) {
    const el = {
        button: $("btn-chest"),
        all: $("btn-chest-all"),
        count: $("chest-count"),
        loot: $("loot"),
        chest: $("loot-chest"),
        rarity: $("loot-rarity"),
        lines: $("loot-lines"),
        hint: $("loot-hint"),
        lootAll: $("loot-all"),
    };
    let opening = false;
    let skipping = false;
    let wake = null;
    let pendingLevels = [];

    // A sleep that skip() can end early; once skipping, every later wait is instant.
    const wait = (ms) =>
        skipping
            ? Promise.resolve()
            : new Promise((resolve) => {
                  const t = setTimeout(resolve, ms);
                  wake = () => {
                      clearTimeout(t);
                      resolve();
                  };
              });

    function skip() {
        if (!opening) return false;
        skipping = true;
        wake?.();
        return true;
    }

    const gain = (sourceEl, boost) => modal.whenFree(() => dropChest(sourceEl, boost));

    function dropChest(sourceEl, boost) {
        if (!luck.addChest(state, boost)) return;
        commit();
        sfx.chest();
        const from = fx.centerOf(sourceEl);
        const to = fx.centerOf(el.button);
        fx.float(from.x, from.y - 24, TEXT.chestFound, { color: "y", size: 24, life: 70 });
        fx.burst(from.x, from.y, { count: 24, colors: ["y", "O", "w"], speed: [1.5, 4], life: [20, 36] });
        fx.burst(to.x, to.y, { count: 14, colors: ["y", "w"], speed: [1, 2.5], life: [16, 28] });
        fx.pop(el.button);
    }

    function gainWhileAway(minutes) {
        const expected = minutes / LUCK.awayMinutesPerChest;
        const count = Math.min(LUCK.awayMaxChests, Math.floor(expected) + (luck.chance(expected % 1) ? 1 : 0));
        let added = 0;
        for (let i = 0; i < count; i++) if (luck.addChest(state)) added++;
        return added;
    }

    function paint(rarity) {
        el.loot.style.setProperty("--rarity", PALETTE[rarity.color]);
        el.rarity.textContent = rarity.name;
    }

    // Takes the front chest, applies a reward of the given rarity and logs it.
    function claim(rarity) {
        state.chests.shift();
        state.stats.chestsOpened++;
        const { lines, levels } = luck.applyReward(state, luck.rollReward(rarity));
        onOpened({ type: "chest", rarity: rarity.id, text: lines.map((l) => l.text).join(", ") });
        emit("chest-open", { rarity: rarity.id });
        return { lines, levels };
    }

    function showClosed() {
        skipping = false;
        el.chest.innerHTML = svgIcon("chest", 7);
        el.lines.innerHTML = "";
        el.hint.textContent = TEXT.skipHint;
        el.lootAll.hidden = true;
        el.loot.removeAttribute("data-revealed");
        el.loot.removeAttribute("data-cosmic");
        el.loot.hidden = false;
    }

    async function spinRoulette(steps, endRank) {
        let i = (((endRank - steps.length) % 4) + 4) % 4;
        for (const ms of steps) {
            i = (i + 1) % 4;
            paint(LUCK.rarities[i]);
            sfx.tick();
            fx.shake(el.chest, 1 + Math.floor(ms / 100), ms);
            await wait(ms);
            if (skipping) break;
        }
        if (endRank >= 2 && !skipping) {
            fx.shake(el.chest, 6, 500);
            await wait(500);
        }
    }

    function showRevealed(rarity, linesMarkup) {
        const rank = luck.rarityIndex(rarity);
        el.chest.innerHTML = svgIcon("chest-open", 7);
        el.loot.setAttribute("data-revealed", "");
        el.lines.innerHTML = linesMarkup;
        el.hint.textContent = TEXT.tapToClose;
        el.lootAll.hidden = state.chests.length < 2;
        el.lootAll.textContent = TEXT.openAll(state.chests.length);
        fx.pop(el.chest);
        sfx.reveal(rank);
        const p = fx.centerOf(el.chest);
        fx.burst(p.x, p.y, { count: 20 + rank * 25, colors: [rarity.color, "w", rarity.color], speed: [1.5, 3 + rank * 1.5], life: [24, 50] });
        if (rank >= 2) fx.confetti(rank - 1);
        if (rank >= 1) fx.coinShower(p.x, p.y, 4 + rank * 6);
    }

    async function open() {
        if (opening || !el.loot.hidden || !state.chests.length) return;
        opening = true;
        const rarity = luck.rollRarity(state.chests[0]);
        showClosed();
        await spinRoulette(ROULETTE, luck.rarityIndex(rarity));

        const { lines, levels } = claim(rarity);
        commit();
        paint(rarity);
        showRevealed(rarity, linesHtml(lines));
        pendingLevels = levels;
        opening = false;
    }

    // Chester: open the whole stash without the overlay. Blessed chests a reward adds wait for the next tick.
    function autoOpen(fromEl) {
        const count = state.chests.length;
        if (opening || !el.loot.hidden || !count) return 0;
        const lines = [];
        const levels = [];
        for (let i = 0; i < count; i++) {
            const got = claim(luck.rollRarity(state.chests[0]));
            lines.push(...got.lines);
            levels.push(...got.levels);
        }
        commit();
        const p = fx.centerOf(fromEl);
        fx.float(p.x + 40, p.y + 26, TEXT.chesterOpened(count), { color: "y", rise: 0.35, life: 90 });
        luck.mergeLines(lines).forEach((l, i) => fx.float(p.x + 40, p.y + 44 + i * 16, l.text, { color: "G", rise: 0.35, life: 90 + i * 8 }));
        fx.burst(p.x, p.y, { count: 20, colors: ["y", "O", "w"], speed: [1, 3], life: [16, 30] });
        sfx.chest();
        emit("chester-eat", { count });
        if (levels.length) onLevelUp(levels);
        return count;
    }

    // OPEN ALL never blocks play: the whole stash opens at once and the tally lands in a toast, so mining
    // and spinning carry on underneath. Rewards come from the same claim() as a single chest.
    function openAll() {
        const count = state.chests.length;
        if (opening || count < 2) return;
        const rarities = state.chests.map((boost) => luck.rollRarity(boost));
        const best = rarities.reduce((a, b) => (luck.rarityIndex(b) > luck.rarityIndex(a) ? b : a));
        const lines = [];
        const levels = [];
        for (const rarity of rarities) {
            const got = claim(rarity);
            lines.push(...got.lines);
            levels.push(...got.levels);
        }
        commit();
        const rank = luck.rarityIndex(best);
        const tally = LUCK.rarities
            .map((r) => [r, rarities.filter((x) => x === r).length])
            .filter(([, n]) => n)
            .map(([r, n]) => `<span style="color:${PALETTE[r.color]}">${n} ${r.name}</span>`)
            .join(" ");
        const merged = luck.mergeLines(lines);
        const shown = merged.slice(0, TOAST_LINES).map((l) => l.text);
        if (merged.length > TOAST_LINES) shown.push(TEXT.moreLines(merged.length - TOAST_LINES));
        toast({ icon: "chest-open", tag: TEXT.openedAll(count), title: tally, text: shown.join(" · "), color: best.color, ms: 4500 });
        sfx.reveal(rank);
        const p = fx.centerOf(el.button);
        fx.burst(p.x, p.y, { count: 20 + rank * 15, colors: [best.color, "w", "y"], speed: [1.5, 3 + rank], life: [20, 40] });
        if (rank >= 1) fx.coinShower(p.x, p.y, 4 + rank * 4);
        if (levels.length) onLevelUp(levels);
    }

    function cosmic(win) {
        state.stats.cosmic++;
        for (let i = 0; i < COSMIC.chests; i++) state.chests.push(COSMIC.chestBoost);
        const lines = [
            { icon: "coin", text: `+${econ.formatNumber(win)} COIN` },
            { icon: "chest", text: TEXT.cosmicChests(COSMIC.chests) },
            ...luck.applyReward(state, { type: "goldRush", seconds: COSMIC.goldRushSeconds }).lines,
            ...luck.applyReward(state, { type: "hotMachine", spins: COSMIC.hotSpins }).lines,
        ];
        commit();
        setTimeout(() => {
            if (opening) return;
            el.chest.innerHTML = svgIcon("cosmic", 7);
            el.rarity.textContent = TEXT.tier.cosmic;
            el.lines.innerHTML = linesHtml(lines);
            el.hint.textContent = TEXT.tapToClose;
            el.lootAll.hidden = true;
            el.loot.setAttribute("data-revealed", "");
            el.loot.setAttribute("data-cosmic", "");
            el.loot.hidden = false;
            fx.pop(el.chest);
            const p = fx.centerOf(el.chest);
            fx.burst(p.x, p.y, { count: 60, colors: ["y", "v", "c", "w"], speed: [2, 6], life: [30, 60] });
        }, 3800);
    }

    // Reuse the loot overlay for any reveal (expedition returns, big harvests).
    function reveal({ icon, title, color = "y", lines }) {
        if (opening || !el.loot.hidden) return false;
        el.chest.innerHTML = svgIcon(icon, 7);
        el.loot.style.setProperty("--rarity", PALETTE[color]);
        el.rarity.textContent = title;
        el.lines.innerHTML = linesHtml(lines);
        el.hint.textContent = TEXT.tapToClose;
        el.lootAll.hidden = true;
        el.loot.removeAttribute("data-cosmic");
        el.loot.setAttribute("data-revealed", "");
        el.loot.hidden = false;
        fx.pop(el.chest);
        sfx.reveal(2);
        const p = fx.centerOf(el.chest);
        fx.burst(p.x, p.y, { count: 40, colors: [color, "w", "G"], speed: [1.5, 4], life: [24, 44] });
        return true;
    }

    function close() {
        if (opening || el.loot.hidden) return false;
        el.loot.hidden = true;
        if (pendingLevels.length) onLevelUp(pendingLevels);
        pendingLevels = [];
        return true;
    }

    function render() {
        const chests = state.chests.length;
        el.button.hidden = !chests;
        el.count.textContent = chests > 1 ? `x${chests}` : TEXT.open;
        el.all.hidden = chests < 2;
    }

    el.button.addEventListener("click", open);
    el.all.addEventListener("click", openAll);
    el.loot.addEventListener("click", () => close() || skip());
    el.lootAll.addEventListener("click", (e) => {
        e.stopPropagation();
        if (close()) openAll();
    });

    return { gain, gainWhileAway, open, openAll, autoOpen, close, skip, render, cosmic, reveal, isOpen: () => !el.loot.hidden };
}
