import { PALETTE, svgIcon } from "./sprites.js";

// Toasts: small cards that slide in from the left edge and stack, newest at the bottom. They never block
// input, so spamming and combos carry on underneath. Each one leaves after `ms` (paused while hovered) or on X.

const MAX = 4;
const root = document.createElement("div");
root.className = "toasts";
document.body.append(root);

function dismiss(card) {
    if (card.dataset.out) return;
    card.dataset.out = "1";
    // Reduced motion turns animations off, so there is no animationend to wait for.
    if (getComputedStyle(card).animationName === "none") return card.remove();
    card.addEventListener("animationend", () => card.remove(), { once: true });
}

/** @param {{ icon?: string, tag?: string, title: string, text?: string, color?: string, ms?: number }} spec  color is a palette key. */
export function toast({ icon, tag = "", title, text = "", color = "y", ms = 3000 }) {
    const card = document.createElement("div");
    card.className = "toast";
    card.style.setProperty("--tone", PALETTE[color]);
    card.style.setProperty("--ms", `${ms}ms`);
    card.innerHTML = `
        ${icon ? `<span class="toast-icon">${svgIcon(icon, 2)}</span>` : ""}
        <span class="toast-text">${tag ? `<em>${tag}</em>` : ""}<b>${title}</b>${text ? `<small>${text}</small>` : ""}</span>
        <button class="toast-x" aria-label="Close">${svgIcon("i-close", 1)}</button>
        <i class="toast-timer"></i>`;
    card.querySelector(".toast-x").addEventListener("click", () => dismiss(card));
    const timer = card.querySelector(".toast-timer");
    timer.addEventListener("animationend", () => dismiss(card));
    root.append(card);
    if (getComputedStyle(timer).animationName === "none") setTimeout(() => dismiss(card), ms);
    [...root.children].filter((c) => !c.dataset.out).slice(0, -MAX).forEach(dismiss);
}
