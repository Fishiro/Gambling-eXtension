import { ITEMS, GEAR, GEAR_MAX, GEAR_STARS, GEAR_SETS, SET_STARS, BREWS } from "./core/config.js";
import { state, commit } from "./store.js";
import * as econ from "./core/economy.js";
import * as luck from "./core/luck.js";
import * as items from "./core/items.js";
import { svgIcon, PALETTE } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit, on } from "./events.js";
import { $, costHtml, patch } from "./ui.js";

const IDS = Object.keys(ITEMS);
const statText = (gear, level) => {
    const v = items.gearValue(gear, level);
    return gear.pct ? `+${Math.round(v * 100)}%` : `+${econ.formatNumber(v)}`;
};
// LV1-LV5, then pixel stars (gold = earned, outline = to go) once the piece ascends.
const levelHtml = (lv) =>
    lv > GEAR_MAX ? `${svgIcon("pstar", 2).repeat(lv - GEAR_MAX)}${svgIcon("pstar-off", 2).repeat(GEAR_MAX + GEAR_STARS - lv)}` : `LV${lv}/${GEAR_MAX}`;
const levelText = (lv) => (lv > GEAR_MAX ? `STAR ${lv - GEAR_MAX}` : `LV${lv}`);

export function createBag() {
    const el = {
        panel: $("tab-bag"),
        tabs: document.querySelectorAll("[data-bag]"),
        views: document.querySelectorAll("[data-bag-view]"),
        detail: $("item-detail"),
        grid: $("item-grid"),
        gear: $("gear-list"),
        brews: $("brew-list"),
        forgeDot: document.querySelector('[data-dot="forge"]'),
        sets: $("set-list"),
    };
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
        // Junk scraps for coins; keep it instead if a combo brew needs it.
        const use = item.use
            ? `<button class="primary-sm" data-action="use" data-id="${selected}" ${n ? "" : "disabled"}>${TEXT.use}</button>`
            : item.junk
              ? `<button class="primary-sm" data-action="scrap" data-id="${selected}" ${n ? "" : "disabled"}>${TEXT.scrap(econ.formatNumber(n * luck.scrapValue(state, selected)))}</button>`
              : "";
        return `<span class="detail-art">${svgIcon(selected, 4)}</span>
            <div class="detail-info">
                <b style="color:${PALETTE[rarity.color]}">${item.name}</b>
                <small>${rarity.name} / ${TEXT.owned(econ.formatNumber(n))}</small>
                ${item.effect ? `<small class="y">${item.effect}</small>` : ""}
                <small>${TEXT.foundIn(item.from)}</small>
            </div>
            ${use}`;
    }

    function gearHtml(gear) {
        const lv = items.gearLevel(state, gear.id);
        const maxed = items.isMaxed(state, gear);
        const cost = items.gearCost(gear, lv);
        // A star attempt can fail, so its button says the odds.
        const label = lv >= GEAR_MAX ? TEXT.ascendChance(Math.round(items.upgradeChance(state, gear) * 100)) : lv ? TEXT.upgrade : TEXT.craft;
        const button = maxed
            ? `<button disabled>${TEXT.max}</button>`
            : `<button class="primary-sm" data-action="upgrade" data-id="${gear.id}" ${items.canAfford(state, cost) ? "" : "disabled"}>${label}</button>`;
        return `<div class="row" data-ready="${!maxed && items.canAfford(state, cost)}" data-stars="${lv > GEAR_MAX}">
            <span class="row-icon">${svgIcon(gear.icon, 2)}</span>
            <div class="row-main">
                <b>${gear.name}</b>
                <small><em class="lv">${levelHtml(lv)}</em>${gear.label} ${statText(gear, lv)}${maxed ? "" : `${svgIcon("i-next", 1)}${statText(gear, lv + 1)}`}</small>
                ${maxed ? "" : `<span class="chips">${costHtml(state, cost)}</span>`}
            </div>
            ${button}
        </div>`;
    }

    // A combo brew stays a secret until every ingredient has been in the bag at least once.
    const learned = (brew) => !brew.combo || Object.keys(brew.cost).every((id) => id in state.bag);

    function brewHtml(brew, i) {
        const item = items.item(brew.id);
        const heading = brew.combo && !BREWS[i - 1]?.combo ? `<h5 class="list-sub">${TEXT.comboBrews}</h5>` : "";
        if (!learned(brew)) {
            return `${heading}<div class="row" data-secret>
            <span class="row-icon">${svgIcon("lock", 2)}</span>
            <div class="row-main">
                <b>${TEXT.secretBrew}</b>
                <small>${TEXT.secretBrewHint}</small>
                <span class="chips">${costHtml(state, items.brewCost(brew))}</span>
            </div>
        </div>`;
        }
        return `${heading}<div class="row">
            <span class="row-icon">${svgIcon(brew.id, 2)}</span>
            <div class="row-main">
                <b>${item.name} <em>x${items.count(state, brew.id)}</em></b>
                <small>${item.effect}</small>
                <span class="chips">${costHtml(state, items.brewCost(brew))}</span>
            </div>
            <button class="primary-sm" data-action="brew" data-id="${brew.id}" ${items.canAfford(state, items.brewCost(brew)) ? "" : "disabled"}>${TEXT.brew}</button>
        </div>`;
    }

    // A set lights up once every piece in it reaches SET_STARS stars.
    function setHtml(set) {
        const on = items.setActive(state, set);
        const pieces = set.gear.map((id) => {
            const g = GEAR.find((x) => x.id === id);
            return `<span class="chip" data-short="${items.gearStars(state, id) < SET_STARS}">${svgIcon(g.icon, 1)}${items.gearStars(state, id)}${svgIcon("pstar", 1)}</span>`;
        });
        return `<div class="set-card" data-on="${on}">
            <b>${set.name}</b>
            <small>${TEXT.setBonus(Math.round(set.per * 100), set.label, `<span class="stars">${SET_STARS}${svgIcon("pstar", 1)}+</span>`)}</small>
            <span class="chips">${pieces.join("")}</span>
        </div>`;
    }

    const anyUpgrade = () => GEAR.some((g) => items.canUpgrade(state, g));

    function render() {
        el.forgeDot.hidden = !anyUpgrade();
        if (el.panel.hidden) return;
        if (view === "items") {
            patch(el.grid, IDS.map(tileHtml).join(""));
            patch(el.detail, detailHtml());
        }
        if (view === "forge") {
            patch(el.gear, GEAR.map(gearHtml).join(""));
            patch(el.sets, GEAR_SETS.map(setHtml).join(""));
            patch(el.brews, BREWS.map(brewHtml).join(""));
        }
    }

    const ACTIONS = {
        upgrade(id, button) {
            const gear = GEAR.find((g) => g.id === id);
            econ.settleOre(state);
            const result = items.upgrade(state, gear);
            if (!result) return deny(button);
            commit();
            if (result !== "up") {
                const row = button.closest(".row") ?? button;
                (result === "crack" ? sfx.crack : sfx.fizzle)();
                fx.shake(row, result === "crack" ? 5 : 3, 350);
                const p = fx.centerOf(row);
                fx.burst(p.x, p.y, { count: result === "crack" ? 24 : 10, colors: ["r", "R", "S"], speed: [1.5, 4], life: [16, 30] });
                fx.float(p.x, p.y - 16, result === "crack" ? TEXT.ascendCrack : TEXT.ascendFail, { color: "R", life: 80 });
                emit("ascend-fail", { id, lost: result === "crack" });
                return;
            }
            (items.gearLevel(state, id) > GEAR_MAX ? sfx.ascend : sfx.anvil)();
            celebrate(button, `${gear.name} ${levelText(items.gearLevel(state, id))}`);
            emit("craft", { id, level: items.gearLevel(state, id) });
        },
        brew(id, button) {
            const recipe = BREWS.find((b) => b.id === id);
            if (!items.spend(state, items.brewCost(recipe))) return deny(button);
            items.add(state, id);
            commit();
            sfx.brew();
            celebrate(button, `+1 ${items.item(id).name}`);
            emit("brew", { id });
        },
        scrap(id, button) {
            const coins = luck.scrap(state, id);
            if (!coins) return deny(button);
            commit();
            sfx.scrap();
            celebrate(button, `+${econ.formatNumber(coins)} COIN`);
            emit("scrap", { id, coins });
        },
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
    // Pets own their view; the bag only answers clicks in items and forge.
    el.views.forEach((v) => ["items", "forge"].includes(v.dataset.bagView) && v.addEventListener("click", onClick));

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
