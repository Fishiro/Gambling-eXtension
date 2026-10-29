import { state, commit } from "./store.js";
import { on } from "./events.js";
import { svgIcon } from "./sprites.js";
import { sfx } from "./sound.js";
import * as fx from "./fx.js";
import { TEXT } from "./text.js";
import * as modal from "./modal.js";
import { MINE_CODES } from "./keys.js";

const ACTION_KEYS = {
    spin: ["Space", "Enter"],
    stop: ["Space", "Enter"],
    "tab-mine": ["Digit2"],
    "tab-farm": ["Digit3"],
    "tab-bag": ["Digit4", "KeyB"],
    "bag-forge": ["KeyF"],
    "bag-pets": ["KeyP"],
    tap: ["Space", ...MINE_CODES],
};
const PAD = 6;
const TYPE_MS = 22;
// A fresh line can't be skipped for GUARD_MS, and presses closer than SPAM_GAP_MS apart count as
// spam (mining, mashing), not as "next". So a line only moves on with a deliberate press.
const GUARD_MS = 700;
const SPAM_GAP_MS = 350;

// Diggs' guided tours: the first-time tour, and a short one each time a feature unlocks (see unlocks.js).
export function createTutorial({ setTab }) {
    let steps = TEXT.tour;
    const root = document.createElement("div");
    root.className = "tour";
    root.hidden = true;
    root.innerHTML = `
        <div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div>
        <div class="tour-ring"></div>
        <div class="tour-bubble">
            <span class="tour-avatar">${svgIcon("miner", 3)}</span>
            <div class="tour-body">
                <b class="tour-name">${TEXT.tourName}</b>
                <p class="tour-text"></p>
                <div class="tour-actions">
                    <button class="tour-skip">${TEXT.tourSkip}</button>
                    <span class="tour-hint"></span>
                    <button class="tour-next" data-fx="y,w">${TEXT.tourNext}</button>
                </div>
            </div>
        </div>`;
    document.body.append(root);
    const shades = [...root.querySelectorAll(".tour-shade")];
    const ring = root.querySelector(".tour-ring");
    const bubble = root.querySelector(".tour-bubble");
    const textEl = root.querySelector(".tour-text");
    const hint = root.querySelector(".tour-hint");
    const next = root.querySelector(".tour-next");

    let index = -1;
    let typing = 0;
    let fullText = "";
    let unlisten = null;
    let progress = 0;
    let shownAt = 0;
    let lastPress = 0;
    let unlockTimer = 0;

    const step = () => steps[index];

    function hole() {
        if (root.dataset.mode === "transit") return null;
        const target = step().target && document.querySelector(step().target);
        if (!target || !target.offsetParent) return null;
        const r = target.getBoundingClientRect();
        return { left: r.left - PAD, top: r.top - PAD, right: r.right + PAD, bottom: r.bottom + PAD };
    }

    function layout() {
        if (root.hidden) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const r = hole() ?? { left: w / 2, top: h / 2, right: w / 2, bottom: h / 2 };
        const boxes = [
            [0, 0, w, r.top],
            [0, r.bottom, w, h - r.bottom],
            [0, r.top, r.left, r.bottom - r.top],
            [r.right, r.top, w - r.right, r.bottom - r.top],
        ];
        shades.forEach((s, i) => {
            const [x, y, bw, bh] = boxes[i];
            Object.assign(s.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, bw)}px`, height: `${Math.max(0, bh)}px` });
        });
        ring.hidden = r.right === r.left;
        Object.assign(ring.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.right - r.left}px`, height: `${r.bottom - r.top}px` });
        // The bubble sits under or over the target, but always fully on screen, even for a target that is
        // taller than the screen or still scrolling into view.
        const fit = (y) => `${Math.max(8, Math.min(h - bubble.offsetHeight - 8, y))}px`;
        const below = (r.top + r.bottom) / 2 < h / 2;
        bubble.style.top = below ? fit(r.bottom + 10) : "";
        bubble.style.bottom = below ? "" : fit(h - r.top + 10);
        if (r.right === r.left) {
            bubble.style.top = `${(h - bubble.offsetHeight) / 2}px`;
            bubble.style.bottom = "";
        }
        requestAnimationFrame(layout);
    }

    function type() {
        clearInterval(typing);
        textEl.textContent = "";
        let i = 0;
        typing = setInterval(() => {
            i++;
            textEl.textContent = fullText.slice(0, i);
            if (i % 3 === 0) sfx.talk();
            if (i >= fullText.length) clearInterval(typing);
        }, TYPE_MS);
    }

    function show(i) {
        unlisten?.();
        unlisten = null;
        index = i;
        if (index >= steps.length) return finish();
        const s = step();
        if (s.tab) setTab(s.tab);
        // A target down a scrolled list (the forge's brews, the garden...) comes into view first.
        const target = s.target && document.querySelector(s.target);
        if (target?.offsetParent) target.scrollIntoView({ block: "nearest" });
        fullText = s.text;
        progress = 0;
        type();
        next.hidden = Boolean(s.wait);
        next.textContent = s.last ? TEXT.tourDone : TEXT.tourNext;
        hint.textContent = s.wait ? TEXT.tourDoIt : `${index + 1}/${steps.length}`;
        root.dataset.mode = s.wait ? "action" : "talk";
        shownAt = performance.now();
        next.disabled = true;
        clearTimeout(unlockTimer);
        unlockTimer = setTimeout(() => (next.disabled = false), GUARD_MS);
        fx.pop(bubble);
        if (s.wait) {
            unlisten = on(s.wait, () => {
                progress++;
                if (progress < (s.count ?? 1)) return;
                // Done: drop the highlight right away so the change underneath is visible, then move on.
                unlisten();
                root.dataset.mode = "transit";
                const after = index + 1;
                setTimeout(() => !root.hidden && show(after), s.delay ?? 250);
            });
        }
    }

    function advance() {
        const now = performance.now();
        const spam = now - lastPress < SPAM_GAP_MS;
        lastPress = now;
        if (spam || now - shownAt < GUARD_MS) return;
        if (typing && textEl.textContent.length < fullText.length) {
            clearInterval(typing);
            textEl.textContent = fullText;
            return;
        }
        if (!step().wait) show(index + 1);
    }

    function finish() {
        unlisten?.();
        clearInterval(typing);
        clearTimeout(unlockTimer);
        root.hidden = true;
        index = -1;
        state.tutorialDone = true;
        commit();
        sfx.levelUp();
        fx.confetti(1);
        modal.hold(false);
    }

    next.addEventListener("click", advance);
    root.querySelector(".tour-skip").addEventListener("click", finish);
    shades.forEach((s) => s.addEventListener("click", () => step() && !step().wait && advance()));

    return {
        start(list = TEXT.tour) {
            steps = list;
            modal.hold(true);
            root.hidden = false;
            show(0);
            requestAnimationFrame(layout);
        },
        active: () => !root.hidden,
        handleKey(e) {
            const s = step();
            if (e.code === "Escape") {
                finish();
                return true;
            }
            if (s.wait) return !(ACTION_KEYS[s.wait] ?? []).includes(e.code);
            if (!e.repeat && (e.code === "Space" || e.code === "Enter")) advance();
            return true;
        },
    };
}
