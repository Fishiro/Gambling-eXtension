import { ITEMS } from "./core/config.js";
import { state, commit } from "./store.js";
import * as econ from "./core/economy.js";
import * as luck from "./core/luck.js";
import * as items from "./core/items.js";
import { svgIcon, svgFit, PALETTE } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit, on } from "./events.js";
import { $, patch } from "./ui.js";
import { createForge } from "./forge.js";
import { createBrewery, learned } from "./brewery.js";

const IDS = Object.keys(ITEMS);
export function createBag() {
    const el = {
        panel: $("tab-bag"),
        tabs: document.querySelectorAll("[data-bag]"),
        views: document.querySelectorAll("[data-bag-view]"),
        detail: $("item-detail"),
        grid: $("item-grid"),
        forgeDot: document.querySelector('[data-dot="forge"]'),
        brewDot: document.querySelector('[data-dot="brew"]'),
    };
    // FORGE (the anvil) and BREW live in their own modules; the bag switches between them and ITEMS.
    const forge = createForge();
    const brewery = createBrewery();
    let view = "items";
    let selected = null;
    const fresh = new Set();

    function show(name) {
        view = name;
        el.tabs.forEach((t) => {
            const on = t.dataset.bag === name;
            t.classList.toggle("is-active", on);
            t.setAttribute("aria-selected", String(on));
        });
        el.views.forEach((v) => (v.hidden = v.dataset.bagView !== name));
        render();
        emit("bag-view", { view: name });
        emit(`bag-${name}`);
    }

    function tileHtml(id) {
        const n = items.count(state, id);
        const known = id in state.bag;
        const rarity = items.rarityOf(id);
        return `<button class="tile" data-item="${id}" data-tip="${id}" data-known="${!!known}" aria-pressed="${selected === id}" style="--tone:${PALETTE[rarity.color]}">
            ${svgIcon(id, 3)}<b>${n ? econ.formatNumber(n) : ""}</b>${fresh.has(id) ? `<i class="new">${TEXT.new}</i>` : ""}
        </button>`;
    }

    function detailHtml() {
        if (!selected) return `<p class="hint">${TEXT.bagHint}</p>`;
        const item = items.item(selected);
        const rarity = items.rarityOf(selected);
        const n = items.count(state, selected);
        const use = item.use ? `<button class="primary-sm detail-use" data-action="use" data-id="${selected}" ${n ? "" : "disabled"}>${TEXT.use}</button>` : "";
        return `<div class="detail-top">
                <span class="detail-art">${svgFit(selected, 32)}</span>
                <div class="detail-info">
                    <b style="color:${PALETTE[rarity.color]}">${item.name}</b>
                    <small>${rarity.name} / ${TEXT.owned(econ.formatNumber(n))}</small>
                    ${item.effect ? `<small class="y">${item.effect}</small>` : ""}
                    <small>${TEXT.foundIn(item.from)}</small>
                </div>
            </div>
            ${use}
            ${usesHtml(selected)}
            ${item.junk ? scrapHtml(selected, n) : ""}`;
    }

    // What the item is crafted into. Secret combo brews stay secret until learned.
    function usesHtml(id) {
        const uses = items.usesOf(id);
        if (!uses.length) return `<div class="detail-uses"><small class="detail-label">${TEXT.usedIn}</small><span class="hint">${TEXT.usedNowhere}</span></div>`;
        const chips = uses.map((u) => {
            const secret = u.brew && !learned(u.brew);
            const icon = secret ? "lock" : u.icon;
            const name = secret ? TEXT.secretBrew : u.name;
            const where = u.kind === "plant" ? "" : `data-action="${u.kind === "brew" ? "brew" : "forge"}"`;
            return `<button class="use-chip" ${where} title="${name}">${svgIcon(icon, 2)}<span>${name}</span><em>x${u.n}${u.kind === "star" ? "+" : ""}</em></button>`;
        });
        return `<div class="detail-uses"><small class="detail-label">${TEXT.usedIn}</small><div class="use-chips">${chips.join("")}</div></div>`;
    }

    // Junk: the price per piece, then scrap one, scrap the spare ones a brew doesn't need, or scrap them all.
    // Each button says what it does on top and what it pays underneath.
    function scrapHtml(id, n) {
        const each = luck.scrapValue(state, id);
        const keep = items.brewNeed(id);
        const spare = Math.max(0, n - keep);
        const button = (label, count, cls = "") =>
            `<button class="scrap-btn ${cls}" data-action="scrap" data-id="${id}" ${count === n ? "" : `data-n="${count}"`} ${count ? "" : "disabled"}>
                <b>${label}</b><small>${svgFit("coin", 8)}+${econ.formatNumber(count * each)}</small>
            </button>`;
        return `<div class="detail-scrap">
                <small class="detail-label">${TEXT.scrapEach(econ.formatNumber(each))}</small>
                ${keep ? `<small class="r">${TEXT.scrapKeep(keep)}</small>` : ""}
                <div class="scrap-buttons">
                    ${button(TEXT.scrapOne, Math.min(1, n))}
                    ${keep && spare && spare < n ? button(TEXT.scrapExtra(spare), spare) : ""}
                    ${button(TEXT.scrapAll(n), n, "primary-sm")}
                </div>
            </div>`;
    }

    const anyUpgrade = () => forge.anyReady();

    function render() {
        el.forgeDot.hidden = !anyUpgrade();
        el.brewDot.hidden = !brewery.anyReady();
        if (el.panel.hidden) return;
        if (view === "items") {
            patch(el.grid, IDS.map(tileHtml).join(""));
            patch(el.detail, detailHtml());
        }
        if (view === "forge") forge.render();
        if (view === "brew") brewery.render();
    }

    const ACTIONS = {
        scrap(id, button) {
            const coins = luck.scrap(state, id, button.dataset.n ? Number(button.dataset.n) : Infinity);
            if (!coins) return deny(button);
            commit();
            sfx.scrap();
            celebrate(button, `+${econ.formatNumber(coins)} COIN`);
            emit("scrap", { id, coins });
        },
        forge: () => show("forge"),
        brew: () => show("brew"),
        use(id, button) {
            if (!items.spend(state, { [id]: 1 })) return deny(button);
            const { lines } = luck.applyReward(state, items.item(id).use);
            commit();
            sfx.drink();
            const p = fx.centerOf(button);
            lines.forEach((l, i) => fx.float(p.x, p.y - 20 - i * 16, l.text, { color: "y", life: 70 }));
            fx.confetti(1);
            emit("brew-use", { id });
        },
    };

    function deny(button) {
        sfx.denied();
        fx.shake(button, 2, 200);
    }

    function celebrate(button, text) {
        const p = fx.centerOf(button.closest(".row") ?? button);
        fx.burst(p.x, p.y, { count: 24, colors: ["y", "G", "w"], speed: [1.5, 3.5], life: [18, 34] });
        fx.float(p.x, p.y - 16, text, { color: "y", life: 70 });
    }

    el.tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.bag)));
    // Pets, forge and brew handle their own clicks; the bag answers the items view.
    el.views.forEach((v) => v.dataset.bagView === "items" && v.addEventListener("click", onClick));

    function onClick(e) {
        const tile = e.target.closest("[data-item]");
        if (tile) {
            selected = tile.dataset.item;
            fresh.delete(selected);
            return render();
        }
        const button = e.target.closest("[data-action]");
        if (button) ACTIONS[button.dataset.action](button.dataset.id, button);
    }

    // Drops from any source float up where they happened and get a NEW tag in the bag.
    on("drops", ({ drops, from }) => {
        if (!drops?.length) return;
        const p = fx.centerOf(from);
        sfx.drop(Math.max(...drops.map((d) => luck.rarityIndex(items.rarityOf(d.id)))));
        drops.forEach((d, i) => {
            fresh.add(d.id);
            const rarity = items.rarityOf(d.id);
            setTimeout(() => fx.float(p.x + 40, p.y - 10 - i * 12, `+${d.n} ${items.item(d.id).name}`, { color: rarity.color, size: 8, rise: 0.5, life: 55 }), i * 140);
        });
        render();
    });

    show(view);

    return {
        render,
        show,
        needsAttention: () => fresh.size > 0 || anyUpgrade(),
        noteNew: (loot) => Object.keys(loot).forEach((id) => fresh.add(id)),
    };
}
