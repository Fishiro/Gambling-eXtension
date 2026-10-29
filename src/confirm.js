import { state } from "./store.js";
import * as modal from "./modal.js";
import { sfx } from "./sound.js";
import { formatNumber } from "./core/economy.js";
import { TEXT } from "./text.js";
import { costHtml } from "./ui.js";

// Ask before a spend that can't be undone (anything that costs diamonds, or risks a star): what it is, the cost as
// have/need chips, and the diamonds left after. `onOk` runs only on the player's yes.
export function confirmSpend({ icon, title, cost, notes = [], ok, onOk }) {
    const left = cost.gems ? [`<small class="confirm-left">${TEXT.gemsLeft(formatNumber(state.gems - cost.gems))}</small>`] : [];
    modal.show({
        icon,
        title,
        sub: TEXT.confirmSub,
        lines: [...notes, `<span class="chips confirm-cost">${costHtml(state, cost)}</span>`, ...left],
        ok,
        cancel: TEXT.cancel,
        color: "c",
        sound: sfx.modal,
        onOk,
    });
}
