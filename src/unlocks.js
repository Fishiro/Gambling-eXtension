import { UNLOCKS } from "./config.js";
import { state, commit } from "./store.js";
import * as fx from "./fx.js";
import { hint } from "./tooltip.js";
import * as modal from "./modal.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

// Features open up by level. A feature's door is just `state.level`; `state.unlocked` remembers which
// ones Diggs has already introduced, so each new feature gets its own short tour exactly once.

const byId = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));

export const isOpen = (state, id) => !byId[id] || state.level >= byId[id].level;

// Which feature each dock tab and bag view belongs to.
const TABS = { farm: "farm", bag: "bag" };
const VIEWS = { forge: "forge", pets: "pets", skins: "skins", relics: "endgame" };

export const tabOpen = (tab) => isOpen(state, TABS[tab]);
export const viewOpen = (view) => isOpen(state, VIEWS[view]);

export function createUnlocks({ tour, stopAuto }) {
    // Old saves (no list yet): everything the player already reached counts as introduced.
    // Saved with the next commit; committing here would re-enter main before it is wired up.
    if (!Array.isArray(state.unlocked)) state.unlocked = UNLOCKS.filter((u) => isOpen(state, u.id)).map((u) => u.id);

    // Show or hide everything a feature owns.
    function apply() {
        document.querySelectorAll("[data-tab]").forEach((t) => {
            const feature = byId[TABS[t.dataset.tab]];
            const locked = feature && !isOpen(state, feature.id);
            t.dataset.locked = String(Boolean(locked));
            t.title = locked ? TEXT.unlocksAt(feature.level) : "";
        });
        document.querySelectorAll("[data-bag]").forEach((b) => (b.hidden = !viewOpen(b.dataset.bag)));
        $("btn-pet").hidden = !isOpen(state, "pets");
        $("gems").hidden = !isOpen(state, "skins") && !state.gems;
        $("vip").hidden = $("vault").hidden = !isOpen(state, "endgame");
    }

    // A tap on something still locked: say when it opens.
    function deny(id, el) {
        sfx.denied();
        if (!el) return;
        fx.shake(el, 3, 300);
        hint(el, `${TEXT.unlocksAt(byId[id].level)}: ${byId[id].name}`);
    }

    // Once a second: when nothing else is on screen, introduce the next newly opened feature.
    function tick() {
        if (tour.active() || modal.isOpen()) return;
        const next = UNLOCKS.find((u) => isOpen(state, u.id) && !state.unlocked.includes(u.id));
        if (!next) return;
        state.unlocked.push(next.id);
        commit();
        stopAuto();
        apply();
        tour.start(TEXT.unlockTours[next.id]);
    }

    apply();
    return { apply, tick, deny, tabFeature: (tab) => TABS[tab], viewFeature: (view) => VIEWS[view] };
}
