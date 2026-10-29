import { svgFit } from "./sprites.js";
import { sfx } from "./sound.js";
import { tabOpen } from "./unlocks.js";
import { state } from "./store.js";

// Right-click quick menu: the browser's own menu is off, and a ring opens around the pointer with the four tabs
// on it and the menu button in its centre, right under the pointer. It doesn't dodge the window's edges; a player
// who opens it too close to one just moves a little and right-clicks again. Text fields keep the native menu
// (copy and paste a backup code, edit a bet).

const RADIUS = 72;
// Clockwise from the top.
const ITEMS = [
    { tab: "slot", icon: "i-seven", angle: -90 },
    { tab: "mine", icon: "i-pick", angle: 0 },
    { tab: "farm", icon: "i-farm", angle: 90 },
    { tab: "bag", icon: "i-bag", angle: 180 },
];

export function createRadial({ goTab, openMenu, blocked }) {
    const root = document.createElement("div");
    root.className = "radial";
    root.hidden = true;
    root.innerHTML = `<span class="radial-ring"></span>
        ${ITEMS.map(({ tab, icon, angle }) => {
            const a = (angle * Math.PI) / 180;
            return `<button class="radial-item" data-go="${tab}" style="--x:${Math.round(Math.cos(a) * RADIUS)}px;--y:${Math.round(Math.sin(a) * RADIUS)}px">${svgFit(icon, 16)}<small>${tab.toUpperCase()}</small></button>`;
        }).join("")}
        <button class="radial-center" data-go="menu" aria-label="Menu">${svgFit("i-menu", 12)}</button>`;
    document.body.append(root);

    const isOpen = () => !root.hidden;

    function open(x, y) {
        root.style.left = `${x}px`;
        root.style.top = `${y}px`;
        root.querySelectorAll(".radial-item").forEach((b) => {
            b.dataset.locked = String(!tabOpen(b.dataset.go));
            b.toggleAttribute("aria-current", b.dataset.go === state.tab);
        });
        root.hidden = false;
        sfx.menuOpen();
    }

    function close() {
        if (!isOpen()) return false;
        root.hidden = true;
        return true;
    }

    root.addEventListener("click", (e) => {
        const go = e.target.closest("[data-go]")?.dataset.go;
        if (!go) return;
        close();
        if (go === "menu") openMenu();
        else goTab(go);
    });

    document.addEventListener("contextmenu", (e) => {
        if (e.target.closest("input, textarea")) return;
        e.preventDefault();
        if (isOpen()) return close();
        if (!blocked()) open(e.clientX, e.clientY);
    });
    // A press anywhere else closes it (the press still does its own job).
    document.addEventListener("pointerdown", (e) => e.button === 0 && !root.contains(e.target) && close(), true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);

    return { isOpen, close };
}
