import { BUFF_CHIPS } from "./config.js";
import { state } from "./store.js";
import { formatClock } from "./economy.js";
import { timedLeft } from "./luck.js";
import { PALETTE, svgIcon } from "./sprites.js";
import { $ } from "./ui.js";

// The buff row: one chip per entry in BUFF_CHIPS, shown while its value in state.buffs is live.
export function createBuffs() {
    const chips = BUFF_CHIPS.map((def) => {
        const chip = document.createElement("span");
        chip.className = `buff ${def.cls}`;
        chip.title = def.title;
        if (def.color) chip.style.setProperty("--tone", PALETTE[def.color]);
        chip.innerHTML = `<i data-icon="${def.icon}">${svgIcon(def.icon, def.scale ?? 2)}</i><b>${def.text ?? ""}</b>`;
        chip.hidden = true;
        $("buffs").append(chip);
        return { def, chip, value: chip.querySelector("b") };
    });

    function render() {
        for (const { def, chip, value } of chips) {
            const left = def.kind === "timer" ? timedLeft(state, def.key) : state.buffs[def.key];
            chip.hidden = !(left > 0);
            if (left > 0 && !def.text) value.textContent = def.kind === "timer" ? formatClock(left) : left;
        }
    }

    return { render };
}
