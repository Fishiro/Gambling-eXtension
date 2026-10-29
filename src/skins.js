import { SKINS } from "./core/config.js";
import { state, commit } from "./store.js";
import { svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $, patch } from "./ui.js";
import { emit, on } from "./events.js";

const owns = (id) => state.skins.owned.includes(id);
// A skin with `requires` is not sold: it unlocks once you own every listed pet.
const unlocked = (skin) => (skin.requires ?? []).every((id) => state.pets.owned.includes(id));

// Cosmetic mine skins, paid in diamonds. No stats: they only change how the mine scene looks.
export function createSkins() {
    const list = $("skin-list");

    function cardHtml(skin) {
        const owned = owns(skin.id);
        const active = state.skins.active === skin.id;
        const locked = !owned && !unlocked(skin);
        const action = active
            ? `<button disabled>${TEXT.skinWorn}</button>`
            : owned
              ? `<button data-skin="equip" data-id="${skin.id}" data-fx="c,w">${TEXT.petEquip}</button>`
              : skin.requires
                ? `<button data-skin="buy" data-id="${skin.id}" data-fx="c,R,w" ${locked ? "disabled" : ""}>${locked ? skin.requires.map((id) => svgIcon(id, 1)).join("") + TEXT.skinNeeds : TEXT.skinClaim}</button>`
                : `<button data-skin="buy" data-id="${skin.id}" data-fx="c,w,v" ${state.gems < skin.price ? "disabled" : ""}>${svgIcon("gem", 2)}${skin.price}</button>`;
        return `<div class="pet-card skin-card" data-state="${active ? "active" : owned ? "owned" : "locked"}" data-secret="${locked}">
            <span class="pet-art">${svgIcon(skin.icon, 4)}</span>
            <div class="pet-info"><b>${skin.name}</b><small class="pet-kind">${TEXT.skinKind}</small><p>${skin.desc}</p></div>
            <div class="pet-actions">${action}</div>
        </div>`;
    }

    function render() {
        if (list.offsetParent) patch(list, SKINS.map(cardHtml).join(""));
    }

    const ACTIONS = {
        buy(skin, button) {
            if (state.gems < skin.price || !unlocked(skin)) return sfx.denied();
            const p = fx.centerOf(button);
            state.gems -= skin.price;
            state.skins.owned.push(skin.id);
            state.skins.active = skin.id;
            commit();
            sfx.skinBuy();
            fx.confetti(2);
            fx.burst(p.x, p.y, { count: 30, colors: ["c", "w", "v"], speed: [1.5, 4], life: [20, 40] });
            fx.float(p.x, p.y - 20, TEXT.skinNew(skin.name), { color: "c", life: 80 });
            emit("skin-buy", { id: skin.id });
        },
        equip(skin) {
            state.skins.active = skin.id;
            commit();
            sfx.upgrade();
        },
    };

    list.addEventListener("click", (e) => {
        const button = e.target.closest("[data-skin]");
        if (!button) return;
        ACTIONS[button.dataset.skin](SKINS.find((s) => s.id === button.dataset.id), button);
        render();
    });
    on("bag-view", ({ view }) => view === "skins" && render());

    return { render };
}
