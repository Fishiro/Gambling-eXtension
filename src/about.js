import { svgFit } from "./sprites.js";
import * as modal from "./modal.js";
import { sfx } from "./sound.js";
import { toast } from "./toast.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

// The ABOUT page in the menu: the project and its developer, with a link to the dev's site and a Ko-fi button.
// Every link asks first (the player is about to leave the game) and opens in a new tab.

export const LINKS = {
    site: "https://itsduqui.io.vn",
    // The Ko-fi page isn't set up yet: while this is empty the button still asks, then says it's coming soon.
    donate: "",
};

const version = () => globalThis.chrome?.runtime?.getManifest?.().version ?? "DEV";

// Ask before leaving the game; open `url` in a new tab on OK (or, with no url yet, say it's coming soon).
function leave(url, { icon, title }) {
    modal.show({
        icon,
        title,
        sub: TEXT.about.leaving,
        lines: [`<b class="about-url">${url || TEXT.about.comingSoon}</b>`],
        ok: TEXT.about.open,
        cancel: TEXT.about.stay,
        color: "c",
        sound: sfx.modal,
        onOk() {
            if (url) window.open(url, "_blank", "noopener,noreferrer");
            else toast({ icon: "kofi", tag: TEXT.about.kofi, title: TEXT.about.comingSoon, text: TEXT.about.thanks, color: "c" });
        },
    });
}

export function createAbout() {
    const A = TEXT.about;
    const root = $("menu-about");
    root.innerHTML = `
        <section class="about-card">
            <img class="about-logo" src="../assets/icons/icon128.png" alt="" width="72" height="72" />
            <div class="about-main">
                <b class="about-title">PIXEL SLOTS <em>AFK</em></b>
                <small class="about-version">${TEXT.version(version())}</small>
                <p>${A.pitch}</p>
            </div>
        </section>
        <section class="about-card about-dev">
            <span class="about-avatar">${svgFit("miner", 32)}</span>
            <div class="about-main">
                <small class="about-label">${A.devLabel}</small>
                <b class="about-name">${A.devName}</b>
                <p>${A.devLine}</p>
            </div>
        </section>
        <ul class="about-facts">${A.facts.map((f) => `<li>${f}</li>`).join("")}</ul>
        <div class="about-links">
            <button class="primary about-link" data-link="site" data-fx="c,w">${svgFit("miner", 16)}<span>${A.visit}</span></button>
            <button class="about-link about-kofi" data-link="donate" data-fx="c,R,w">${svgFit("kofi", 16)}<span>${A.kofi}</span></button>
        </div>`;

    root.querySelector('[data-link="site"]').addEventListener("click", () => leave(LINKS.site, { icon: "miner", title: A.visitAsk }));
    root.querySelector('[data-link="donate"]').addEventListener("click", () => leave(LINKS.donate, { icon: "kofi", title: A.kofiAsk }));
}
