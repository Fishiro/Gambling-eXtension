import { HOTKEYS } from "../src/keys.js";
import { TEXT } from "../src/text.js";

// The web page around the game: scales the 760x580 popup to fit the screen, and fills the side panels with
// the keys (from keys.js, the same list the game binds) for the tab you are on. Keys light up as you press them.

const GAME_W = 760;
const GAME_H = 580;
const TIP_MS = 9000;
const W = TEXT.web;

const $ = (id) => document.getElementById(id);
const game = $("game");
const frame = $("frame");
const stage = $("stage");

// ---- fit: the biggest scale that shows the whole game in the stage ----

function fit() {
    const scale = Math.min(stage.clientWidth / GAME_W, stage.clientHeight / GAME_H);
    frame.style.width = `${GAME_W * scale}px`;
    frame.style.height = `${GAME_H * scale}px`;
    game.style.transform = `scale(${scale})`;
}
new ResizeObserver(fit).observe(stage);

// ---- side panels ----

const kbd = (cap) => `<kbd>${cap}</kbd>`;
const row = (k, i) => `<div class="key" data-key="${i}">
        <span class="caps">${k.caps.map(kbd).join("")}${k.alt ? `<i>/</i>${k.alt.map(kbd).join("")}` : ""}</span>
        <small>${k.label}</small>
    </div>`;

function renderTab(tab) {
    document.body.dataset.tab = tab;
    $("here-title").textContent = `${W.here}: ${W.tabs[tab] ?? tab.toUpperCase()}`;
    const keys = HOTKEYS.map((k, i) => [k, i]).filter(([k]) => k.group === tab);
    $("here-keys").innerHTML = keys.length ? keys.map(([k, i]) => row(k, i)).join("") : "";
    $("here-mouse").innerHTML = (W.mouse[tab] ?? []).map((t) => `<li>${t}</li>`).join("");
}

$("web-title").textContent = W.title;
$("any-title").textContent = W.everywhere;
$("any-keys").innerHTML = HOTKEYS.map((k, i) => [k, i]).filter(([k]) => k.group === "any").map(([k, i]) => row(k, i)).join("");
$("saves").textContent = W.saves;

let tipIndex = Math.floor(Math.random() * W.tips.length);
function nextTip() {
    const tip = $("tip");
    tip.textContent = W.tips[tipIndex++ % W.tips.length];
    tip.classList.remove("is-new");
    void tip.offsetWidth;
    tip.classList.add("is-new");
}
nextTip();
setInterval(nextTip, TIP_MS);

// ---- press feedback: the keycaps of whatever you pressed sink and glow for a moment ----

// Which rows a key press belongs to. SHIFT+O is its own row; plain O is the other.
function rowsFor(e) {
    return HOTKEYS.map((k, i) => [k, i])
        .filter(([k]) => k.codes.includes(e.code) && (e.code !== "KeyO" || k.caps.includes("SHIFT") === e.shiftKey))
        .map(([, i]) => i);
}

function flash(e) {
    for (const i of rowsFor(e)) {
        document.querySelectorAll(`[data-key="${i}"]`).forEach((el) => {
            el.classList.remove("is-down");
            void el.offsetWidth;
            el.classList.add("is-down");
        });
    }
}

// ---- wiring to the game in the frame (same origin) ----

game.addEventListener("load", () => {
    const win = game.contentWindow;
    const doc = game.contentDocument;
    win.addEventListener("keydown", flash, true);
    for (const tab of Object.keys(W.tabs)) doc.addEventListener(`gx:tab-${tab}`, () => renderTab(tab));
    renderTab(doc.querySelector(".tab.is-active")?.dataset.tab ?? "slot");
    win.focus();
});

// Keys pressed while the page (not the game) has focus still play: hand them to the game and focus it.
document.addEventListener("keydown", (e) => {
    const win = game.contentWindow;
    // Browser shortcuts (reload, zoom, dev tools...) stay the browser's.
    if (!win || e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
    e.preventDefault();
    win.focus();
    win.document.dispatchEvent(new win.KeyboardEvent("keydown", { code: e.code, key: e.key, shiftKey: e.shiftKey, repeat: e.repeat, bubbles: true }));
    flash(e);
});
// Clicking a side panel gives the keyboard back to the game.
document.querySelectorAll(".rail").forEach((rail) => rail.addEventListener("pointerup", () => game.contentWindow?.focus()));

renderTab("slot");
fit();
