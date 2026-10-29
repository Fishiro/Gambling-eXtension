import { RELICS } from "./core/config.js";
import { state, commit } from "./store.js";
import * as relics from "./core/relics.js";
import * as items from "./core/items.js";
import { svgIcon, PALETTE } from "./sprites.js";
import * as fx from "./fx.js";
import * as modal from "./modal.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $, patch } from "./ui.js";
import { emit, on } from "./events.js";

const RARITY_COLOR = { rare: "B", epic: "v", legendary: "y" };
const tone = (relic) => PALETTE[RARITY_COLOR[relic.rarity]];

// BAG > RELICS: the relic case on the stage, the three worn slots and their total on the side.
export function createArmory() {
    const el = { list: $("relic-list"), slots: $("relic-slots") };

    function relicHtml(relic) {
        const worn = relics.isWorn(state, relic.uid);
        const def = relics.rarityDef(relic);
        const full = !state.relics.equipped.includes(null);
        return `<div class="relic" data-worn="${worn}" style="--tone:${tone(relic)}">
            <span class="relic-art">${svgIcon("relic", 3)}</span>
            <div class="row-main">
                <b>${relics.relicName(relic)}</b>
                <em>${relic.rarity.toUpperCase()}</em>
                ${relic.stats.map((s) => `<small>${relics.statLine(s)}</small>`).join("")}
            </div>
            <div class="relic-actions">
                <button class="${worn ? "" : "primary-sm"}" data-relic="${worn ? "unequip" : "equip"}" data-id="${relic.uid}" ${!worn && full ? "disabled" : ""}>${worn ? TEXT.relicOff : TEXT.relicOn}</button>
                <button data-relic="reroll" data-id="${relic.uid}" data-fx="c,w,v" ${state.gems < def.reroll ? "disabled" : ""}>${svgIcon("gem", 1)}${def.reroll} ${TEXT.reroll}</button>
                <button data-relic="salvage" data-id="${relic.uid}">${svgIcon("relicDust", 1)}+${def.dust}</button>
            </div>
        </div>`;
    }

    function slotsHtml() {
        const worn = state.relics.equipped.map((uid) => uid && relics.findRelic(state, uid));
        const slots = worn
            .map((r) => (r ? `<div class="relic-slot" style="--tone:${tone(r)}">${svgIcon("relic", 2)}<b>${relics.relicName(r)}</b></div>` : `<div class="relic-slot" data-empty="true">${TEXT.relicEmpty}</div>`))
            .join("");
        const totals = {};
        worn.forEach((r) => r?.stats.forEach((s) => (totals[s.stat] = (totals[s.stat] ?? 0) + s.per)));
        const sum = Object.entries(totals).map(([stat, per]) => `<small class="y">${relics.statLine({ stat, per })}</small>`);
        return `${slots}${sum.length ? `<div class="relic-sum">${sum.join("")}</div>` : ""}<small class="hint">${TEXT.relicCount(state.relics.list.length, RELICS.cap)}</small>`;
    }

    function render() {
        if (!el.list.offsetParent) return;
        const list = [...state.relics.list].sort((a, b) => relics.isWorn(state, b.uid) - relics.isWorn(state, a.uid));
        patch(el.list, list.length ? list.map(relicHtml).join("") : `<p class="hint">${TEXT.relicNone}</p>`);
        patch(el.slots, slotsHtml());
    }

    const ACTIONS = {
        equip(relic) {
            if (!relics.equip(state, relic.uid)) return sfx.denied();
            sfx.relicEquip();
            emit("relic-equip");
        },
        unequip(relic) {
            relics.unequip(state, relic.uid);
            sfx.petUnequip();
        },
        reroll(relic, button) {
            const cost = relics.rarityDef(relic).reroll;
            if (!items.spend(state, { gems: cost })) return sfx.denied();
            Object.assign(relic, relics.reroll(relic));
            const p = fx.centerOf(button.closest(".relic"));
            fx.burst(p.x, p.y, { count: 24, colors: ["c", "v", "w"], speed: [1.5, 3.5], life: [16, 30] });
            sfx.reroll();
            emit("relic-reroll");
        },
        salvage(relic) {
            // Salvage is forever, so it asks first.
            modal.show({
                icon: "relicDust",
                title: TEXT.salvageAsk,
                sub: relics.relicName(relic),
                lines: relic.stats.map(relics.statLine),
                ok: TEXT.salvageYes(relics.rarityDef(relic).dust),
                cancel: TEXT.cancel,
                color: "v",
                onOk() {
                    relics.salvage(state, relic.uid);
                    emit("relic-salvage");
                    commit();
                    render();
                    sfx.scrap();
                },
            });
        },
    };

    el.list.addEventListener("click", (e) => {
        const button = e.target.closest("[data-relic]");
        if (!button) return;
        const relic = relics.findRelic(state, button.dataset.id);
        if (!relic) return;
        ACTIONS[button.dataset.relic](relic, button);
        commit();
        render();
    });
    on("bag-view", ({ view }) => view === "relics" && render());

    return { render };
}
