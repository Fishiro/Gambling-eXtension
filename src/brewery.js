import { BREWS } from "./core/config.js";
import { state, commit } from "./store.js";
import * as luck from "./core/luck.js";
import * as items from "./core/items.js";
import { svgFit } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit } from "./events.js";
import { $, costHtml, patch } from "./ui.js";

// The BREW view: every brew with its cost, how many you hold, and BREW / DRINK right there. Combo brews (made
// from junk) sit under their own heading and stay secret until every ingredient has been found once.

// A combo brew stays a secret until every ingredient has been in the bag at least once.
export const learned = (brew) => !brew.combo || Object.keys(brew.cost).every((id) => id in state.bag);
const brewable = (brew) => learned(brew) && items.canAfford(state, items.brewCost(brew));

export function createBrewery() {
    const el = { list: $("brew-list") };

    function rowHtml(brew, i) {
        const heading = brew.combo && !BREWS[i - 1]?.combo ? `<h5 class="list-sub">${TEXT.comboBrews}</h5>` : "";
        if (!learned(brew)) {
            return `${heading}<div class="row brew-row" data-secret>
                <span class="row-icon">${svgFit("lock", 16)}</span>
                <div class="row-main">
                    <b>${TEXT.secretBrew}</b>
                    <small class="stat-name">${TEXT.secretBrewHint}</small>
                    <span class="chips">${costHtml(state, items.brewCost(brew))}</span>
                </div>
            </div>`;
        }
        const item = items.item(brew.id);
        const held = items.count(state, brew.id);
        return `${heading}<div class="row brew-row" data-ready="${brewable(brew)}">
                <span class="row-icon">${svgFit(brew.id, 16)}</span>
                <div class="row-main">
                    <b>${item.name} <em>x${held}</em></b>
                    <small>${item.effect}</small>
                    <span class="chips">${costHtml(state, items.brewCost(brew))}</span>
                </div>
                <div class="brew-actions">
                    <button class="primary-sm" data-action="brew" data-id="${brew.id}" ${brewable(brew) ? "" : "disabled"}>${TEXT.brew}</button>
                    <button data-action="drink" data-id="${brew.id}" ${held ? "" : "disabled"}>${TEXT.drink}</button>
                </div>
            </div>`;
    }

    const render = () => patch(el.list, BREWS.map(rowHtml).join(""));

    function celebrate(button, text) {
        const p = fx.centerOf(button.closest(".row") ?? button);
        fx.burst(p.x, p.y, { count: 24, colors: ["y", "G", "w"], speed: [1.5, 3.5], life: [18, 34] });
        fx.float(p.x, p.y - 16, text, { color: "y", life: 70 });
    }

    const ACTIONS = {
        brew(id, button) {
            const recipe = BREWS.find((b) => b.id === id);
            if (!items.spend(state, items.brewCost(recipe))) return sfx.denied();
            items.add(state, id);
            commit();
            sfx.brew();
            celebrate(button, `+1 ${items.item(id).name}`);
            emit("brew", { id });
        },
        drink(id, button) {
            if (!items.spend(state, { [id]: 1 })) return sfx.denied();
            const { lines } = luck.applyReward(state, items.item(id).use);
            commit();
            sfx.drink();
            const p = fx.centerOf(button);
            lines.forEach((l, i) => fx.float(p.x, p.y - 20 - i * 16, l.text, { color: "y", life: 70 }));
            fx.confetti(1);
            emit("brew-use", { id });
        },
    };

    el.list.addEventListener("click", (e) => {
        const button = e.target.closest("[data-action]");
        if (button && !button.disabled) ACTIONS[button.dataset.action](button.dataset.id, button);
    });

    return { render, anyReady: () => BREWS.some(brewable) };
}
