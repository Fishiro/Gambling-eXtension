import { freshState, restore } from "./core/save.js";

// The one live game state, persisted to localStorage. The save format itself (version, migrations, sanity
// checks) lives in core/save.js.

const KEY = "gx_state";
const LEGACY_KEYS = ["gx_balance", "gx_pool", "gx_farm_points", "gx_last_tick", "gx_farm_progress"];

function load() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(KEY));
    } catch {
        localStorage.removeItem(KEY);
    }
    const loaded = saved && restore(saved);
    if (loaded) return loaded;
    const base = freshState();
    const legacyCoins = parseInt(localStorage.getItem("gx_balance"), 10);
    if (legacyCoins > base.coins) base.coins = legacyCoins;
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    return base;
}

export const state = load();

const listeners = new Set();

export const subscribe = (fn) => listeners.add(fn);

// Set by wipe() and importSave(): nothing may write the old state back while the page reloads.
let frozen = false;

export function commit() {
    if (frozen) return;
    state.lastSeen = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    listeners.forEach((fn) => fn(state));
}

export const exportSave = () => JSON.stringify(state);

// Restore a backup (already checked with core/save.restore): write it and freeze, so the reload picks it up.
export function importSave(data) {
    frozen = true;
    localStorage.setItem(KEY, JSON.stringify(data));
}

export function wipe() {
    frozen = true;
    localStorage.removeItem(KEY);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
}
