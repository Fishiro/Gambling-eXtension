import { state } from "./store.js";
import * as items from "./items.js";
import { formatNumber } from "./economy.js";
import { PALETTE, svgIcon } from "./sprites.js";
import { TEXT } from "./text.js";

// Hover card for anything tagged data-tip="<item id>" (bag tiles, cost chips, zone loot).
// An optional data-need="<n>" adds a have/need line so short costs say exactly what is missing.
// hint() reuses the same box for short messages ("UNLOCKS AT LV4") next to whatever was tapped.

const tip = document.getElementById("tip");
const note = document.getElementById("hint");
const GAP = 8;
const EDGE = 24;
let anchor = null;
let noteTimer = 0;

// Above the anchor if there is room, else below; always inside the gold frame.
function placeNear(box, target) {
    const r = target.getBoundingClientRect();
    const t = box.getBoundingClientRect();
    const left = Math.min(Math.max(EDGE, r.left + r.width / 2 - t.width / 2), window.innerWidth - EDGE - t.width);
    const above = r.top - GAP - t.height;
    const top = above >= EDGE ? above : Math.min(r.bottom + GAP, window.innerHeight - EDGE - t.height);
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(top)}px`;
}

export function hint(target, text, ms = 1800) {
    note.textContent = text;
    note.hidden = false;
    placeNear(note, target);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note.hidden = true), ms);
}

function cardHtml(id, need) {
    const def = items.item(id);
    const rarity = items.rarityOf(id);
    const have = items.count(state, id);
    const needLine = need
        ? `<span class="tip-need" data-short="${have < need}">${TEXT.tipHaveNeed(formatNumber(have), formatNumber(need))}</span>`
        : `<span class="tip-need" data-short="${have === 0}">${TEXT.tipHave(formatNumber(have))}</span>`;
    return `
        <span class="tip-art">${svgIcon(id, 4)}</span>
        <span class="tip-body">
            <b>${def.name}</b>
            <small class="tip-rarity">${rarity.name}</small>
            ${needLine}
            ${def.effect ? `<small class="tip-effect">${TEXT.tipEffect(def.effect)}</small>` : ""}
            <small class="tip-from">${TEXT.tipFrom(def.from)}</small>
        </span>`;
}


function show(el) {
    const id = el.dataset.tip;
    if (!items.item(id)) return;
    anchor = el;
    tip.innerHTML = cardHtml(id, Number(el.dataset.need) || 0);
    tip.style.setProperty("--tone", PALETTE[items.rarityOf(id).color]);
    tip.hidden = false;
    placeNear(tip, el);
}

function hide() {
    anchor = null;
    tip.hidden = true;
}

document.addEventListener("pointerover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el === anchor) return;
    if (el) show(el);
    else hide();
});
document.addEventListener("pointerdown", hide);
document.addEventListener("scroll", hide, true);
