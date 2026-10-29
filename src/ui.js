import * as items from "./items.js";
import { formatNumber } from "./economy.js";
import { svgIcon } from "./sprites.js";

// Small DOM + markup helpers shared across panels so costs and loot look the same everywhere.

export const $ = (id) => document.getElementById(id);

const ICONS = { coins: "coin", gems: "gem" };
const iconOf = (id) => ICONS[id] ?? id;

export function costHtml(state, cost) {
    return Object.entries(cost)
        .map(([id, need]) => {
            const have = items.count(state, id);
            const tip = id in ICONS ? "" : ` data-tip="${id}" data-need="${need}"`;
            return `<span class="chip" data-short="${have < need}"${tip}>${svgIcon(iconOf(id), 1)}${formatNumber(have)}/${formatNumber(need)}</span>`;
        })
        .join("");
}

export const lootLines = (loot) =>
    Object.entries(loot).map(([id, n]) => ({ icon: id, text: `+${n} ${items.item(id).name}`, color: items.rarityOf(id).color }));

export const lootHtml = (loot) =>
    Object.entries(loot)
        .map(([id, n]) => `<span class="chip" data-tip="${id}">${svgIcon(id, 1)}${n}</span>`)
        .join("");

// Rebuild a container only when its markup actually changes, so buttons are not swapped out mid-click.
const rendered = new WeakMap();

export function patch(node, markup) {
    if (rendered.get(node) === markup) return false;
    node.innerHTML = markup;
    rendered.set(node, markup);
    return true;
}
