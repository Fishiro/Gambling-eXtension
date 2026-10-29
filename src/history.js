import { HISTORY, LUCK } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import { PALETTE, svgIcon } from "./sprites.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

const TIER_LABEL = {
    lose: "LOSE",
    near: "SO CLOSE",
    win: "WIN",
    big: "BIG WIN",
    mega: "MEGA WIN",
    jackpot: "JACKPOT",
    cosmic: "COSMIC ROLL",
};

const FILTERS = {
    all: () => true,
    wins: (e) => e.type === "spin" && e.win > 0,
    chests: (e) => e.type === "chest",
};

function ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return "NOW";
    if (s < 3600) return `${Math.floor(s / 60)}M`;
    if (s < 86400) return `${Math.floor(s / 3600)}H`;
    return `${Math.floor(s / 86400)}D`;
}

const rarityOf = (id) => LUCK.rarities.find((r) => r.id === id);

function spinRow(e) {
    const syms = e.symbols.map((s) => svgIcon(s, 2)).join("");
    const amount = e.win ? `+${econ.formatNumber(e.win)}` : `-${econ.formatNumber(e.bet)}`;
    const detail = [`BET ${econ.formatNumber(e.bet)}`, e.win ? `x${+(e.win / e.bet).toFixed(1)}` : "", e.grade !== "miss" ? e.grade.toUpperCase() : ""]
        .filter(Boolean)
        .join(" ");
    return `<div class="h-row" data-tier="${e.tier}">
        <span class="h-syms">${syms}</span>
        <span class="h-main"><b>${TIER_LABEL[e.tier]}</b><small>${detail}</small></span>
        <span class="h-amt">${amount}</span>
        <small class="h-ago">${ago(e.t)}</small>
    </div>`;
}

function chestRow(e) {
    const rarity = rarityOf(e.rarity);
    return `<div class="h-row" data-tier="chest" style="--tone:${PALETTE[rarity.color]}">
        <span class="h-syms">${svgIcon("chest", 2)}</span>
        <span class="h-main"><b>${rarity.name}</b><small>${e.text}</small></span>
        <span class="h-amt"></span>
        <small class="h-ago">${ago(e.t)}</small>
    </div>`;
}

const row = (e) => (e.type === "chest" ? chestRow(e) : spinRow(e));

export function createHistory() {
    const el = {
        sheet: $("history"),
        summary: $("h-summary"),
        hall: $("h-hall"),
        list: $("h-list"),
        filters: document.querySelectorAll("[data-filter]"),
    };
    let filter = "all";

    function record(entry) {
        const item = { t: Date.now(), ...entry };
        state.history.unshift(item);
        state.history.length = Math.min(state.history.length, HISTORY.max);
        if (item.type === "spin" && item.win) {
            state.hall = [...state.hall, item].sort((a, b) => b.win - a.win).slice(0, HISTORY.hallSize);
            state.stats.bestMult = Math.max(state.stats.bestMult, item.win / item.bet);
        }
        commit();
        if (!el.sheet.hidden) render();
    }

    function render() {
        const { bestWin, bestMult, cosmic, chestsOpened } = state.stats;
        const burn = econ.burnBonus(state.burned);
        el.summary.innerHTML = [
            ["BEST WIN", econ.formatNumber(bestWin)],
            ["BEST MULTI", bestMult ? `x${+bestMult.toFixed(1)}` : "-"],
            ["COSMIC", econ.formatNumber(cosmic)],
            ["CHESTS", econ.formatNumber(chestsOpened)],
            ["BURNED", econ.formatNumber(state.burned)],
            ["BURN BONUS", `+${econ.formatPercent(burn)}`],
        ]
            .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
            .join("");
        el.hall.innerHTML = state.hall.length ? state.hall.map(spinRow).join("") : `<p class="h-empty">${TEXT.hallEmpty}</p>`;
        const items = state.history.filter(FILTERS[filter]);
        el.list.innerHTML = items.length ? items.map(row).join("") : `<p class="h-empty">${TEXT.historyEmpty}</p>`;
        el.filters.forEach((b) => b.classList.toggle("is-active", b.dataset.filter === filter));
    }

    function open() {
        render();
        el.sheet.hidden = false;
        el.sheet.scrollTop = 0;
    }

    function close() {
        el.sheet.hidden = true;
    }

    el.filters.forEach((b) =>
        b.addEventListener("click", () => {
            filter = b.dataset.filter;
            render();
        }),
    );
    $("btn-history").addEventListener("click", open);
    $("btn-history-close").addEventListener("click", close);

    return { record, open, close, isOpen: () => !el.sheet.hidden };
}
