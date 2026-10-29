import { START, FARM } from "./config.js";

const KEY = "gx_state";
const LEGACY_KEYS = ["gx_balance", "gx_pool", "gx_farm_points", "gx_last_tick", "gx_farm_progress"];

const fresh = () => ({
    coins: START.coins,
    ore: 0,
    mineAt: Date.now(),
    xp: 0,
    level: 1,
    betIndex: START.betIndex,
    upgrades: { pick: 0, drill: 0, cart: 0 },
    chests: [],
    burned: 0,
    betEma: 0,
    burnChests: 0,
    buffs: { goldRush: 0, hotSpins: 0, rockSpins: 0, loadedSpins: 0, sevenSpins: 0, midas: 0, titan: 0, phoenix: 0, starSpins: 0, breakerSpins: 0, freeze: 0 },
    heat: 0,
    skill: 0.5,
    freeSpin: true,
    auto: false,
    sound: true,
    tab: "slot",
    tutorialDone: false,
    stats: { spins: 0, timed: 0, perfects: 0, bestWin: 0, bestMult: 0, cosmic: 0, chestsOpened: 0 },
    history: [],
    hall: [],
    // team: equipped pet ids, at most `slots` of them (more slots are bought with diamonds).
    pets: { owned: [], team: [], slots: 1, readyAt: {} },
    gems: 0,
    unlocked: null,
    relics: { list: [], equipped: [null, null, null] },
    vault: { day: "", tier: 0, hp: 0, cracked: false },
    settings: { volume: 100, calm: false, frame: true },
    skins: { owned: ["miner"], active: "miner" },
    bag: {},
    gear: {},
    trip: null,
    garden: Array(FARM.plots).fill(null),
    achv: {},
    fun: {},
    // Ore market: price multiplier, current phase and ticks left in it, start of the current tick,
    // ore sold during it, the glut selling piled up and the drag the price already feels, and recent closes.
    market: { price: 1, phase: "calm", left: 3, at: Date.now(), sold: 0, glut: 0, drag: 0, hist: [] },
    lastSeen: Date.now(),
});

function load() {
    const base = fresh();
    try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (saved) {
            const loaded = {
                ...base,
                ...saved,
                mineAt: saved.mineAt ?? saved.lastSeen ?? Date.now(),
                upgrades: { ...base.upgrades, ...saved.upgrades },
                buffs: { ...base.buffs, ...saved.buffs },
                stats: { ...base.stats, ...saved.stats },
                pets: { ...base.pets, ...saved.pets },
                skins: { ...base.skins, ...saved.skins },
                relics: { ...base.relics, ...saved.relics },
                vault: { ...base.vault, ...saved.vault },
                settings: { ...base.settings, ...saved.settings },
                market: { ...base.market, ...saved.market },
                garden: base.garden.map((_, i) => saved.garden?.[i] ?? null),
            };
            // One equipped pet (`active`) became a team. Auto spin used to open at LV3 and is now SPINNY's job,
            // so players who already had it get SPINNY for free.
            if (!saved.pets?.team) {
                loaded.pets.team = saved.pets?.active ? [saved.pets.active] : [];
                if ((saved.level ?? 1) >= 3 && !loaded.pets.owned.includes("spinny")) loaded.pets.owned = [...loaded.pets.owned, "spinny"];
            }
            delete loaded.pets.active;
            return loaded;
        }
    } catch {
        localStorage.removeItem(KEY);
    }
    const legacyCoins = parseInt(localStorage.getItem("gx_balance"), 10);
    if (legacyCoins > base.coins) base.coins = legacyCoins;
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    return base;
}

export const state = load();

const listeners = new Set();

export const subscribe = (fn) => listeners.add(fn);

// Set by wipe(): nothing may write the old state back while the page reloads.
let frozen = false;

export function commit() {
    if (frozen) return;
    state.lastSeen = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    listeners.forEach((fn) => fn(state));
}

export const exportSave = () => JSON.stringify(state);

// Restore a backup: write it and freeze, so the page reload picks it up untouched.
export function importSave(data) {
    frozen = true;
    localStorage.setItem(KEY, JSON.stringify(data));
}

export function wipe() {
    frozen = true;
    localStorage.removeItem(KEY);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
}
