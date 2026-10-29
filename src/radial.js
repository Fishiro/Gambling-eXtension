import { svgFit } from "./sprites.js";
import { sfx } from "./sound.js";
import { tabOpen } from "./unlocks.js";
import { state } from "./store.js";

// Right-click quick menu: the browser's own menu is off, and a pie opens around the pointer: the menu button in
// its centre, right under the pointer, and a ring cut into four slices by lines at the top, right, bottom and
// left, one tab per slice. It doesn't dodge the window's edges; a player who opens it too close to one just moves
// a little and right-clicks again. Text fields keep the native menu (copy and paste a backup code, edit a bet).

// The ring's outer radius, and its inner one, which is the centre button's edge (they touch).
const OUTER = 84;
const INNER = 32;
// Clockwise from the top: each slice spans 90 degrees, centred on a diagonal (`mid`, 0 = right, 90 = down).
const SLICES = [
    { tab: "slot", icon: "i-seven", mid: -45 },
    { tab: "mine", icon: "i-pick", mid: 45 },
    { tab: "farm", icon: "i-farm", mid: 135 },
    { tab: "bag", icon: "i-bag", mid: 225 },
];

const at = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [Math.round(Math.cos(a) * r * 100) / 100, Math.round(Math.sin(a) * r * 100) / 100];
};

// One ring slice from `mid - 45` to `mid + 45` degrees, as an SVG path around (0, 0).
function slicePath(mid) {
    const [a, b] = [mid - 45, mid + 45];
    const [o1, o2, i1, i2] = [at(a, OUTER), at(b, OUTER), at(b, INNER), at(a, INNER)];
    return `M${o1} A${OUTER} ${OUTER} 0 0 1 ${o2} L${i1} A${INNER} ${INNER} 0 0 0 ${i2} Z`;
}

export function createRadial({ goTab, openMenu, blocked }) {
    const size = OUTER * 2 + 8;
    const root = document.createElement("div");
    root.className = "radial";
    root.hidden = true;
    root.innerHTML = `<svg class="radial-pie" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
            ${SLICES.map(({ tab, mid }) => `<path class="radial-slice" data-go="${tab}" d="${slicePath(mid)}" />`).join("")}
            ${[0, 90, 180, 270].map((deg) => `<line class="radial-cut" x1="${at(deg, INNER)[0]}" y1="${at(deg, INNER)[1]}" x2="${at(deg, OUTER)[0]}" y2="${at(deg, OUTER)[1]}" />`).join("")}
            <circle class="radial-hub" data-go="menu" r="${INNER}" />
        </svg>
        ${SLICES.map(({ tab, icon, mid }) => {
            const [x, y] = at(mid, (OUTER + INNER) / 2);
            return `<span class="radial-label" data-for="${tab}" style="--x:${x}px;--y:${y}px">${svgFit(icon, 16)}<small>${tab.toUpperCase()}</small></span>`;
        }).join("")}
        <span class="radial-hub-icon">${svgFit("i-menu", 16)}</span>`;
    document.body.append(root);

    const isOpen = () => !root.hidden;

    function open(x, y) {
        root.style.left = `${x}px`;
        root.style.top = `${y}px`;
        for (const { tab } of SLICES) {
            const locked = String(!tabOpen(tab));
            const current = tab === state.tab;
            for (const el of root.querySelectorAll(`[data-go="${tab}"], [data-for="${tab}"]`)) {
                el.dataset.locked = locked;
                el.toggleAttribute("data-current", current);
            }
        }
        root.hidden = false;
        sfx.menuOpen();
    }

    function close() {
        if (!isOpen()) return false;
        root.hidden = true;
        return true;
    }

    // The label on a hovered slice lights up with it (labels let the pointer through to the slice).
    const hover = (go) => root.querySelectorAll("[data-for]").forEach((l) => l.toggleAttribute("data-hover", l.dataset.for === go));
    root.addEventListener("pointerover", (e) => hover(e.target.closest("[data-go]")?.dataset.go));
    root.addEventListener("pointerout", (e) => !root.contains(e.relatedTarget) && hover(null));

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
