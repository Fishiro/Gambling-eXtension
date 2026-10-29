import { PALETTE, svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

// One centered card over a dimmed, blurred game. Popups queue up so they never stack;
// `autoClose` popups (trophies) drain a timer bar and leave on their own.
// A popup with `cancel` is a question: OK runs `onOk`, cancel / Esc / the backdrop runs `onCancel`.
// A `danger` question has a red OK that only a deliberate click can press, never Space or Enter.
// While held (the tour is talking), popups queue silently and `whenFree` work waits; release plays it all.

const MAX_LINES = 5;
const el = {
    root: $("modal"),
    card: $("modal-card"),
    art: $("modal-art"),
    title: $("modal-title"),
    sub: $("modal-sub"),
    lines: $("modal-lines"),
    ok: $("modal-ok"),
    cancel: $("modal-cancel"),
    keys: $("modal-keys"),
    timer: $("modal-timer"),
};
const queue = [];
const deferred = [];
let current = null;
let closeTimer = 0;
let holding = false;

export function hold(on) {
    holding = on;
    if (on) return;
    deferred.splice(0).forEach((fn) => fn());
    if (!current) next();
}

// Run now, or as soon as the hold lifts.
export const whenFree = (fn) => (holding ? deferred.push(fn) : fn());

export const isOpen = () => current !== null;

/**
 * @param {{ icon?: string, title: string, sub?: string, lines?: string[], ok: string, cancel?: string,
 *           onOk?: () => void, columns?: number, color?: string, sound?: () => void, confetti?: number, autoClose?: number }} spec
 *   lines are HTML strings; color is a palette key for the frame and title.
 */
export function show(spec) {
    queue.push(spec);
    if (!current && !holding) next();
}

// Long lists never stretch the card: the first few lines, then a "+N MORE" line. A grid shows twice as many.
function linesHtml(lines, columns) {
    const max = MAX_LINES * columns;
    const shown = lines.length > max ? [...lines.slice(0, max - 1), TEXT.moreLines(lines.length - max + 1)] : lines;
    return shown.map((l, i) => `<div style="animation-delay:${200 + i * 110}ms">${l}</div>`).join("");
}

function next() {
    current = holding ? null : (queue.shift() ?? null);
    if (!current) {
        el.root.hidden = true;
        return;
    }
    const { icon, title, sub = "", lines = [], columns = 1, ok, cancel, danger = false, color = "y", sound, confetti = 0, autoClose = 0 } = current;
    el.card.style.setProperty("--tone", PALETTE[color]);
    el.art.innerHTML = icon ? svgIcon(icon, 5) : "";
    el.art.hidden = !icon;
    el.title.textContent = title;
    el.sub.textContent = sub;
    el.sub.hidden = !sub;
    el.lines.innerHTML = linesHtml(lines, columns);
    el.lines.classList.toggle("is-grid", columns > 1);
    el.ok.textContent = ok;
    el.cancel.textContent = cancel ?? "";
    el.cancel.hidden = !cancel;
    el.ok.classList.toggle("danger-btn", danger);
    el.card.dataset.danger = String(danger);
    el.keys.hidden = danger;
    el.timer.hidden = !autoClose;
    el.timer.style.setProperty("--life", `${autoClose}ms`);
    // Restart the CSS entrance + timer animations on every show.
    el.root.hidden = true;
    void el.root.offsetWidth;
    el.root.hidden = false;

    (sound ?? sfx.modal)();
    fx.pop(el.card);
    if (icon) {
        const p = fx.centerOf(el.art);
        fx.burst(p.x, p.y, { count: 28, colors: [color, "w", "y"], speed: [1.5, 4], life: [20, 40] });
    }
    if (confetti) fx.confetti(confetti);
    clearTimeout(closeTimer);
    if (autoClose) closeTimer = setTimeout(close, autoClose);
}

function dismiss(yes) {
    if (!current) return false;
    const { onOk, onCancel } = current;
    clearTimeout(closeTimer);
    sfx.confirm();
    next();
    (yes ? onOk : onCancel)?.();
    return true;
}

// Esc, the backdrop, or the cancel button.
export const close = () => dismiss(false);

// The OK button, or Space / Enter (`byKey`), which a danger question ignores.
export const confirm = (byKey = false) => !(byKey && current?.danger) && dismiss(true);

el.root.addEventListener("click", (e) => {
    if (e.target.closest("#modal-ok")) confirm();
    else if (e.target === el.root || e.target.closest("#modal-cancel")) close();
});
