import { state, commit, exportSave, importSave } from "./store.js";
import { sfx, setSound, setVolume } from "./sound.js";
import * as fx from "./fx.js";
import { TEXT } from "./text.js";
import * as modal from "./modal.js";
import { svgIcon } from "./sprites.js";
import { formatNumber } from "./economy.js";
import { $ } from "./ui.js";

const VOLUME_STEP = 10;
const VOLUME_MAX = 200;
const SAVE_PREFIX = "GX1:";
const IMPORT_NOTE = "gx_import";

// What a save holds, as popup lines: shown before loading it and again once it is loaded.
function saveSummary(data) {
    const count = (list) => (Array.isArray(list) ? list.length : 0);
    const items = Object.values(data.bag ?? {}).reduce((a, n) => a + n, 0);
    const rows = [
        ["coin", `${formatNumber(data.coins)} COIN`],
        ["gem", `${formatNumber(data.gems ?? 0)} DIAMONDS`],
        ["i-star", `LEVEL ${data.level}`],
        ["i-paw", `${count(data.pets?.owned)} PETS`],
        ["miner", `${count(data.skins?.owned) || 1} SKINS`],
        ["chest", `${count(data.chests)} CHESTS`],
        ["i-bag", `${formatNumber(items)} ITEMS`],
        ["i-trophy", `${Object.keys(data.achv ?? {}).length} ACHIEVEMENTS`],
    ];
    return rows.map(([icon, text]) => `${svgIcon(icon, 2)}${text}`);
}

// Settings page: audio, effects, game helpers, save backup. Every change commits and applies at once.
export function createSettings({ startTour, openGuide, bump }) {
    const el = {
        sound: $("set-sound"),
        volume: $("set-volume"),
        volumeOut: $("set-volume-out"),
        calm: $("set-calm"),
        frame: $("set-frame"),
        importBox: $("import-box"),
        importText: $("import-text"),
        importMsg: $("import-msg"),
        exportBtn: $("set-export"),
        version: $("set-version"),
    };
    const prefs = () => state.settings;

    function apply() {
        setSound(state.sound);
        setVolume(prefs().volume / 100);
        fx.setCalm(prefs().calm);
        fx.setFrameFx(prefs().frame);
    }

    function toggle(button, on) {
        button.textContent = on ? TEXT.on : TEXT.off;
        button.classList.toggle("is-on", on);
    }

    function render() {
        const vol = prefs().volume;
        toggle(el.sound, state.sound);
        toggle(el.calm, prefs().calm);
        toggle(el.frame, prefs().frame);
        el.volume.value = vol;
        el.volume.style.setProperty("--pct", `${(vol / VOLUME_MAX) * 100}%`);
        el.volume.dataset.loud = String(vol > 100);
        el.volumeOut.textContent = state.sound ? `${vol}%` : TEXT.muted;
        document.querySelectorAll("[data-vol]").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.vol) === vol));
    }

    function save() {
        commit();
        apply();
        render();
    }

    function toggleSound() {
        state.sound = !state.sound;
        save();
        bump("sound");
    }

    let previewAt = 0;
    function setVol(value) {
        const vol = Math.max(0, Math.min(VOLUME_MAX, Math.round(value / VOLUME_STEP) * VOLUME_STEP));
        prefs().volume = vol;
        if (vol > 0 && !state.sound) state.sound = true;
        save();
        // A short blip so you hear the new level, at most a few times a second while dragging.
        if (performance.now() - previewAt > 120) {
            previewAt = performance.now();
            sfx.coin();
        }
    }

    function exportGame(button) {
        bump("backups");
        const code = SAVE_PREFIX + btoa(unescape(encodeURIComponent(exportSave())));
        navigator.clipboard
            ?.writeText(code)
            .then(() => flash(button, TEXT.copied))
            .catch(() => showImport(code));
        if (!navigator.clipboard) showImport(code);
    }

    function flash(button, text) {
        const old = button.textContent;
        button.textContent = text;
        sfx.coin();
        setTimeout(() => (button.textContent = old), 1400);
    }

    function showImport(text = "") {
        el.importBox.hidden = false;
        el.importText.value = text;
        el.importMsg.textContent = text ? TEXT.copyByHand : TEXT.pasteHere;
        el.importText.focus();
        el.importText.select();
    }

    function readCode() {
        try {
            const raw = el.importText.value.trim();
            if (!raw.startsWith(SAVE_PREFIX)) return null;
            const data = JSON.parse(decodeURIComponent(escape(atob(raw.slice(SAVE_PREFIX.length)))));
            return typeof data.coins === "number" && typeof data.level === "number" ? data : null;
        } catch {
            return null;
        }
    }

    // Ask first, showing what the code holds. Loading restarts the popup; the main screen then says what arrived.
    function importGame() {
        const data = readCode();
        if (!data) {
            sfx.denied();
            el.importMsg.textContent = TEXT.importBad;
            return;
        }
        const lines = saveSummary(data);
        modal.show({
            icon: "chest",
            title: TEXT.importAsk,
            sub: TEXT.importWarn,
            lines,
            columns: 2,
            ok: TEXT.importYes,
            cancel: TEXT.cancel,
            color: "c",
            onOk() {
                // The clock restarts now, so an old backup can't pay out its whole time away.
                data.lastSeen = data.mineAt = Date.now();
                sessionStorage.setItem(IMPORT_NOTE, JSON.stringify(lines));
                importSave(data);
                location.reload();
            },
        });
    }

    function announceImport() {
        const note = sessionStorage.getItem(IMPORT_NOTE);
        if (!note) return;
        sessionStorage.removeItem(IMPORT_NOTE);
        modal.show({ icon: "chest", title: TEXT.importDone, sub: TEXT.importDoneSub, lines: JSON.parse(note), columns: 2, ok: TEXT.importPlay, color: "G", sound: sfx.levelUp, confetti: 2 });
    }

    el.sound.addEventListener("click", toggleSound);
    el.volume.addEventListener("input", () => setVol(Number(el.volume.value)));
    $("set-vol-down").addEventListener("click", () => setVol(prefs().volume - VOLUME_STEP));
    $("set-vol-up").addEventListener("click", () => setVol(prefs().volume + VOLUME_STEP));
    document.querySelectorAll("[data-vol]").forEach((b) => b.addEventListener("click", () => setVol(Number(b.dataset.vol))));
    el.calm.addEventListener("click", () => {
        prefs().calm = !prefs().calm;
        save();
    });
    el.frame.addEventListener("click", () => {
        prefs().frame = !prefs().frame;
        save();
    });
    $("set-tour").addEventListener("click", startTour);
    $("set-keys").addEventListener("click", openGuide);
    el.exportBtn.addEventListener("click", () => exportGame(el.exportBtn));
    $("set-import").addEventListener("click", () => showImport());
    $("import-go").addEventListener("click", importGame);
    $("import-cancel").addEventListener("click", () => (el.importBox.hidden = true));
    // Keys typed into the restore box must not drive the game.
    el.importText.addEventListener("keydown", (e) => e.stopPropagation());

    el.version.textContent = TEXT.version(globalThis.chrome?.runtime?.getManifest?.().version ?? "DEV");
    apply();
    render();

    return { render, toggleSound, announceImport };
}
