import { GEAR, GEAR_MAX, GEAR_STARS, GEAR_SETS, SET_STARS, STAR_CHANCE } from "./core/config.js";
import { state, commit } from "./store.js";
import * as econ from "./core/economy.js";
import * as items from "./core/items.js";
import { svgIcon, svgFit } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit } from "./events.js";
import { $, costHtml, patch } from "./ui.js";
import { confirmSpend } from "./confirm.js";

// The forge: an anvil on top, the gear shelf below (grouped by set). Drag a piece from the shelf onto the anvil
// (or just click it) to see what the next level does and costs, then strike. While the anvil is empty a little
// animated pointer shows the drag. Star attempts can fail and cost diamonds, so they ask first.

const DRAG_START_PX = 6;
const gearById = Object.fromEntries(GEAR.map((g) => [g.id, g]));

const statText = (gear, level) => {
    const v = items.gearValue(gear, level);
    return gear.pct ? `+${Math.round(v * 100)}%` : `+${econ.formatNumber(v)}`;
};
// LV1-LV5, then pixel stars (gold = earned, outline = to go) once the piece ascends.
const levelHtml = (lv) =>
    lv > GEAR_MAX ? `${svgIcon("pstar", 2).repeat(lv - GEAR_MAX)}${svgIcon("pstar-off", 2).repeat(GEAR_MAX + GEAR_STARS - lv)}` : `LV${lv}`;
const levelShort = (lv) => (lv > GEAR_MAX ? `${lv - GEAR_MAX}${svgIcon("pstar", 1)}` : `LV${lv}`);
const levelText = (lv) => (lv > GEAR_MAX ? `STAR ${lv - GEAR_MAX}` : `LV${lv}`);

export function createForge() {
    const el = { anvil: $("anvil"), shelf: $("gear-shelf"), odds: $("forge-odds") };
    // The piece on the anvil (UI only, not saved).
    let placed = null;

    const ready = (gear) => !items.isMaxed(state, gear) && items.canAfford(state, items.gearCost(gear, items.gearLevel(state, gear.id)));
    const anyReady = () => GEAR.some(ready);

    // ---- markup ----

    function emptyAnvilHtml() {
        return `<div class="anvil-slot is-empty" data-drop>
                <span class="anvil-demo" aria-hidden="true">${svgFit(GEAR[0].icon, 16)}<i class="anvil-cursor">${svgIcon("cursor", 2)}</i></span>
                <small>${TEXT.forge.dropHere}</small>
            </div>
            <div class="anvil-info"><b>${TEXT.forge.anvil}</b><p class="hint">${TEXT.forge.dropHint}</p></div>`;
    }

    function anvilHtml() {
        const gear = placed && gearById[placed];
        if (!gear) return emptyAnvilHtml();
        const lv = items.gearLevel(state, gear.id);
        const maxed = items.isMaxed(state, gear);
        const cost = items.gearCost(gear, lv);
        const star = lv >= GEAR_MAX;
        const chance = items.upgradeChance(state, gear);
        const label = maxed ? TEXT.max : star ? TEXT.ascendChance(Math.round(chance * 100)) : lv ? TEXT.upgrade : TEXT.craft;
        const risk = star && !maxed ? `<small class="anvil-risk">${TEXT.forge.risk(Math.round(chance * 100), lv > GEAR_MAX)}</small>` : "";
        return `<div class="anvil-slot is-full" data-drop>
                ${svgFit(gear.icon, 32)}
                <button class="anvil-clear" data-action="clear" aria-label="${TEXT.forge.clear}">${svgFit("i-close", 6)}</button>
            </div>
            <div class="anvil-info">
                <b>${gear.name} <em class="lv">${levelHtml(lv)}</em></b>
                <small class="stat-name">${gear.label}</small>
                <small class="anvil-stat">${statText(gear, lv)}${maxed ? "" : `${svgIcon("i-next", 1)}${statText(gear, lv + 1)}`}</small>
                ${maxed ? "" : `<span class="chips">${costHtml(state, cost)}</span>`}
                ${risk}
                <button class="primary anvil-strike" data-action="strike" ${maxed || !items.canAfford(state, cost) ? "disabled" : ""}>${svgFit("i-hammer", 8)}<span>${label}</span></button>
            </div>`;
    }

    function tileHtml(id) {
        const gear = gearById[id];
        const lv = items.gearLevel(state, id);
        return `<button class="gear-tile" data-gear="${id}" data-ready="${ready(gear)}" data-max="${items.isMaxed(state, gear)}" aria-pressed="${placed === id}" title="${gear.name}">
                ${svgFit(gear.icon, 16)}<small>${levelShort(lv)}</small>
            </button>`;
    }

    // A set's shelf: its bonus, how many pieces reached SET_STARS, then its gear.
    function setHtml(set) {
        const on = items.setActive(state, set);
        const done = set.gear.filter((id) => items.gearStars(state, id) >= SET_STARS).length;
        return `<section class="shelf-set" data-on="${on}">
                <header>
                    <b>${set.name}</b>
                    <small>${TEXT.setBonus(Math.round(set.per * 100), set.label, `<span class="stars">${SET_STARS}${svgIcon("pstar", 1)}</span>`)}</small>
                    <em>${on ? TEXT.forge.setOn : `${done}/${set.gear.length}`}</em>
                </header>
                <div class="shelf-row">${set.gear.map(tileHtml).join("")}</div>
            </section>`;
    }

    function oddsHtml() {
        const rows = STAR_CHANCE.map((p, i) => `<div><span>${svgIcon("pstar", 1).repeat(i + 1)}</span><b>${Math.round(p * 100)}%</b></div>`).join("");
        return `<b>${TEXT.forge.oddsTitle}</b><div class="odds-rows">${rows}</div><small>${TEXT.forge.oddsNote}</small>`;
    }

    function render() {
        patch(el.anvil, anvilHtml());
        el.anvil.dataset.state = placed ? "full" : "empty";
        patch(el.shelf, GEAR_SETS.map(setHtml).join(""));
        patch(el.odds, oddsHtml());
    }

    // ---- actions ----

    function place(id) {
        if (!gearById[id]) return;
        placed = id;
        sfx.petEquip();
        render();
        fx.pop(el.anvil.querySelector(".anvil-slot"));
    }

    function clear() {
        placed = null;
        sfx.petUnequip();
        render();
    }

    function strike(button) {
        const gear = gearById[placed];
        const lv = items.gearLevel(state, gear.id);
        if (lv < GEAR_MAX) return upgrade(gear, button);
        // A star attempt costs diamonds and can crack a star off: ask first.
        const chance = Math.round(items.upgradeChance(state, gear) * 100);
        confirmSpend({
            icon: gear.icon,
            title: TEXT.forge.ascendAsk(gear.name, lv - GEAR_MAX + 1),
            notes: [`<b>${TEXT.forge.risk(chance, lv > GEAR_MAX)}</b>`],
            cost: items.gearCost(gear, lv),
            ok: TEXT.forge.tryIt,
            onOk: () => upgrade(gear, el.anvil.querySelector(".anvil-strike")),
        });
    }

    function upgrade(gear, button) {
        econ.settleOre(state);
        const result = items.upgrade(state, gear);
        const slot = el.anvil.querySelector(".anvil-slot");
        if (!result) {
            sfx.denied();
            return fx.shake(button ?? el.anvil, 2, 200);
        }
        commit();
        const p = fx.centerOf(slot ?? el.anvil);
        if (result !== "up") {
            (result === "crack" ? sfx.crack : sfx.fizzle)();
            fx.shake(el.anvil, result === "crack" ? 5 : 3, 350);
            fx.burst(p.x, p.y, { count: result === "crack" ? 24 : 10, colors: ["r", "R", "S"], speed: [1.5, 4], life: [16, 30] });
            fx.float(p.x, p.y - 16, result === "crack" ? TEXT.ascendCrack : TEXT.ascendFail, { color: "R", life: 80 });
            emit("ascend-fail", { id: gear.id, lost: result === "crack" });
            return;
        }
        (items.gearLevel(state, gear.id) > GEAR_MAX ? sfx.ascend : sfx.anvil)();
        fx.shake(el.anvil, 2, 160);
        fx.burst(p.x, p.y, { count: 28, colors: ["y", "R", "w", "G"], speed: [1.5, 4], life: [18, 34] });
        fx.float(p.x, p.y - 20, `${gear.name} ${levelText(items.gearLevel(state, gear.id))}`, { color: "y", life: 70 });
        emit("craft", { id: gear.id, level: items.gearLevel(state, gear.id) });
    }

    el.anvil.addEventListener("click", (e) => {
        const action = e.target.closest("[data-action]")?.dataset.action;
        if (action === "clear") clear();
        if (action === "strike") strike(e.target.closest("button"));
    });

    // ---- drag and drop: a tile follows the pointer as a ghost and lands on the anvil; a plain click places it ----

    let drag = null;
    const overAnvil = (x, y) => Boolean(document.elementFromPoint(x, y)?.closest("#anvil"));

    el.shelf.addEventListener("pointerdown", (e) => {
        const tile = e.target.closest("[data-gear]");
        if (!tile || e.button !== 0) return;
        // Capture keeps the moves coming while the pointer leaves the shelf (some pointers can't be captured).
        try {
            tile.setPointerCapture(e.pointerId);
        } catch {}
        drag = { id: tile.dataset.gear, tile, x: e.clientX, y: e.clientY, ghost: null };
    });

    el.shelf.addEventListener("pointermove", (e) => {
        if (!drag) return;
        if (!drag.ghost) {
            if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START_PX) return;
            drag.ghost = document.createElement("div");
            drag.ghost.className = "drag-ghost";
            drag.ghost.innerHTML = svgFit(gearById[drag.id].icon, 24);
            document.body.append(drag.ghost);
            drag.tile.classList.add("is-lifted");
            el.anvil.dataset.dragging = "";
        }
        drag.ghost.style.left = `${e.clientX}px`;
        drag.ghost.style.top = `${e.clientY}px`;
        el.anvil.toggleAttribute("data-hover", overAnvil(e.clientX, e.clientY));
    });

    function endDrag(e, dropped) {
        if (!drag) return;
        const { id, ghost, tile } = drag;
        drag = null;
        tile.classList.remove("is-lifted");
        el.anvil.removeAttribute("data-dragging");
        el.anvil.removeAttribute("data-hover");
        if (!ghost) return dropped && place(id);
        ghost.remove();
        if (dropped && overAnvil(e.clientX, e.clientY)) place(id);
    }
    el.shelf.addEventListener("pointerup", (e) => endDrag(e, true));
    el.shelf.addEventListener("pointercancel", (e) => endDrag(e, false));

    return { render, anyReady };
}
