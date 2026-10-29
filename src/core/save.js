import { xpToNext, betCap } from "./economy.js";
import { START, FARM, TIMING, RELICS, LUCK, PETS, SKINS, ITEMS, GEAR, GEAR_MAX, GEAR_STARS } from "./config.js";

// The save format. Pure: no localStorage here (store.js owns that), so it can be tested in Node.
// SAVE_VERSION goes up whenever a saved field changes meaning; migrate() walks an old save forward one step at
// a time, then sanitize() forces every field into a shape and range the game can trust. Both run on load and
// on import, so a hand-edited or broken backup can never crash the game or hand out impossible values.

export const SAVE_VERSION = 4;

export const freshState = (now = Date.now()) => ({
    version: SAVE_VERSION,
    coins: START.coins,
    ore: 0,
    mineAt: now,
    xp: 0,
    level: 1,
    bet: START.bet,
    upgrades: { pick: 0, drill: 0, cart: 0 },
    chests: [],
    burned: 0,
    burnChests: 0,
    buffs: { goldRush: 0, hotSpins: 0, rockSpins: 0, loadedSpins: 0, sevenSpins: 0, midas: 0, titan: 0, phoenix: 0, starSpins: 0, breakerSpins: 0, freeze: 0, bottomless: 0, hype: 0, surge: 0 },
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
    relics: { list: [], equipped: Array(RELICS.slots).fill(null) },
    vault: { day: "", tier: 0, hp: 0, cracked: false },
    // mix: each sound bus's volume in % (see sound.js BUSES).
    settings: { volume: 100, calm: false, frame: true, mix: { ui: 100, slot: 100, mine: 100, loot: 100, world: 100 } },
    skins: { owned: ["miner"], active: "miner" },
    bag: {},
    gear: {},
    trip: null,
    garden: Array(FARM.plots).fill(null),
    achv: {},
    fun: {},
    // Chests opened since the last epic-or-better / legendary (see luck.openRarity).
    pity: { epic: 0, legendary: 0 },
    // Ore market: price multiplier, current phase and ticks left in it, start of the current tick,
    // ore sold during it, the glut selling piled up and the drag the price already feels, and recent closes.
    market: { price: 1, phase: "calm", left: 3, at: now, sold: 0, paid: 0, glut: 0, drag: 0, hist: [] },
    lastSeen: now,
});

// One step per version: MIGRATIONS[v] turns a version-v save into a version-(v+1) save.
const MIGRATIONS = {
    // v0 -> v1 (saves from before the version field): one equipped pet (`active`) became a team. Auto spin used
    // to open at LV3 and is now SPINNY's job, so players who already had it get SPINNY for free.
    0(save) {
        const pets = save.pets ?? {};
        if (!pets.team) {
            pets.team = pets.active ? [pets.active] : [];
            if ((save.level ?? 1) >= 3 && !(pets.owned ?? []).includes("spinny")) pets.owned = [...(pets.owned ?? []), "spinny"];
        }
        delete pets.active;
        save.pets = pets;
        save.mineAt ??= save.lastSeen;
    },
    // v1 -> v2: the LV10 "endgame" unlock split into the vault (LV7) and relics (LV10).
    1(save) {
        if (Array.isArray(save.unlocked) && save.unlocked.includes("endgame")) {
            save.unlocked = [...save.unlocked.filter((id) => id !== "endgame"), "vault", "relics"];
        }
    },
    // v2 -> v3: XP became logarithmic in the stake, on a much smaller scale. Keep the share of the current level
    // already earned. The old curve is frozen here on purpose: it must stay what v2 saves were written with.
    2(save) {
        const level = Number.isFinite(save.level) ? Math.max(1, Math.floor(save.level)) : 1;
        const oldNeed = Math.round(50 * 1.8 ** (Math.min(level, 12) - 1) * 1.25 ** Math.max(0, level - 12));
        const share = Math.min(0.99, Math.max(0, (save.xp ?? 0) / oldNeed));
        save.xp = Math.floor(share * xpToNext(level));
    },
    // v3 -> v4: the bet became a typed amount instead of a step index (the old step list is frozen here).
    3(save) {
        const OLD_STEPS = [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 1000000, 5000000];
        save.bet = OLD_STEPS[save.betIndex] ?? START.bet;
        delete save.betIndex;
    },
};

export function migrate(save) {
    let v = Number.isInteger(save.version) ? save.version : 0;
    while (v < SAVE_VERSION) MIGRATIONS[v++](save);
    save.version = SAVE_VERSION;
    return save;
}

// ---- sanitize: every field is coerced into what fresh() would hold, value by value ----

const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const num = (x, fallback, lo = 0, hi = Number.MAX_SAFE_INTEGER) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback);
const int = (x, fallback, lo, hi) => Math.floor(num(x, fallback, lo, hi));
const bool = (x, fallback) => (typeof x === "boolean" ? x : fallback);
const ids = (list, known) => (Array.isArray(list) ? [...new Set(list.filter((id) => known.has(id)))] : []);
// A map of known keys to numbers in range; unknown keys and bad values are dropped.
const numMap = (map, known, lo, hi) =>
    isObj(map) ? Object.fromEntries(Object.entries(map).filter(([k, v]) => known.has(k) && Number.isFinite(v)).map(([k, v]) => [k, num(v, 0, lo, hi)])) : {};

const PET_IDS = new Set(PETS.map((p) => p.id));
const SKIN_IDS = new Set(SKINS.map((s) => s.id));
const ITEM_IDS = new Set(Object.keys(ITEMS));
const GEAR_IDS = new Set(GEAR.map((g) => g.id));
const TABS = new Set(["slot", "mine", "farm", "bag"]);

function sanitizePets(pets, base) {
    if (!isObj(pets)) return base;
    const owned = ids(pets.owned, PET_IDS);
    const slots = int(pets.slots, 1, 1, 3);
    const team = ids(pets.team, PET_IDS).filter((id) => owned.includes(id)).slice(0, slots);
    return { ...pets, owned, team, slots, readyAt: numMap(pets.readyAt, PET_IDS, 0) };
}

function sanitizeRelics(relics, base) {
    if (!isObj(relics) || !Array.isArray(relics.list)) return base;
    const list = relics.list.filter((r) => isObj(r) && typeof r.uid === "string" && Array.isArray(r.stats)).slice(0, RELICS.cap);
    const uids = new Set(list.map((r) => r.uid));
    const equipped = base.equipped.map((_, i) => (uids.has(relics.equipped?.[i]) ? relics.equipped[i] : null));
    return { list, equipped };
}

// Force a save (already migrated) into a valid state. Unknown fields pass through untouched.
export function sanitize(save, now = Date.now()) {
    const base = freshState(now);
    if (!isObj(save)) return base;
    const s = { ...base, ...save };
    const sub = (key) => ({ ...base[key], ...(isObj(save[key]) ? save[key] : {}) });

    s.coins = num(save.coins, base.coins);
    s.gems = int(save.gems, 0, 0);
    s.ore = num(save.ore, 0);
    s.xp = num(save.xp, 0);
    s.level = int(save.level, 1, 1, 999);
    s.burned = num(save.burned, 0);
    s.burnChests = int(save.burnChests, 0, 0);
    s.bet = int(save.bet, base.bet, 0, betCap(s.level));
    s.heat = int(save.heat, 0, 0, TIMING.heatMax);
    s.skill = num(save.skill, base.skill, 0, 1);
    s.mineAt = num(save.mineAt, now, 0, now);
    s.lastSeen = num(save.lastSeen, now, 0, now);
    s.freeSpin = bool(save.freeSpin, true);
    s.auto = bool(save.auto, false);
    s.sound = bool(save.sound, true);
    s.tutorialDone = bool(save.tutorialDone, false);
    s.tab = TABS.has(save.tab) ? save.tab : "slot";

    s.upgrades = Object.fromEntries(Object.keys(base.upgrades).map((k) => [k, int(save.upgrades?.[k], 0, 0, 500)]));
    s.buffs = { ...base.buffs, ...numMap(save.buffs, new Set(Object.keys(base.buffs)), 0) };
    s.stats = { ...base.stats, ...numMap(save.stats, new Set(Object.keys(base.stats)), 0) };
    s.bag = numMap(save.bag, ITEM_IDS, 0);
    s.gear = Object.fromEntries(Object.entries(numMap(save.gear, GEAR_IDS, 0, GEAR_MAX + GEAR_STARS)).map(([k, v]) => [k, Math.floor(v)]));
    s.chests = Array.isArray(save.chests) ? save.chests.filter(Number.isFinite).slice(0, LUCK.maxChests) : [];
    s.pity = { epic: int(save.pity?.epic, 0, 0), legendary: int(save.pity?.legendary, 0, 0) };

    s.pets = sanitizePets(save.pets, base.pets);
    const skins = sub("skins");
    skins.owned = [...new Set(["miner", ...ids(skins.owned, SKIN_IDS)])];
    if (!skins.owned.includes(skins.active)) skins.active = "miner";
    s.skins = skins;
    s.relics = sanitizeRelics(save.relics, base.relics);

    s.vault = sub("vault");
    s.settings = sub("settings");
    s.settings.mix = { ...base.settings.mix, ...numMap(save.settings?.mix, new Set(Object.keys(base.settings.mix)), 0, 100) };
    s.market = sub("market");
    s.market.price = num(s.market.price, 1, 0.01, 100);
    s.market.at = num(s.market.at, now, 0, now);
    if (!Array.isArray(s.market.hist)) s.market.hist = [];
    s.garden = base.garden.map((_, i) => (isObj(save.garden?.[i]) ? save.garden[i] : null));
    s.trip = isObj(save.trip) && typeof save.trip.zone === "string" ? save.trip : null;
    for (const key of ["history", "hall"]) s[key] = Array.isArray(save[key]) ? save[key] : [];
    for (const key of ["achv", "fun"]) s[key] = isObj(save[key]) ? save[key] : {};
    if (s.unlocked !== null && !Array.isArray(s.unlocked)) s.unlocked = null;
    return s;
}

// Parse a save from anywhere (localStorage, a backup code). Returns a valid state, or null if it isn't a save.
export function restore(raw, now = Date.now()) {
    if (!isObj(raw) || !Number.isFinite(raw.coins) || !Number.isFinite(raw.level)) return null;
    return sanitize(migrate(structuredClone(raw)), now);
}
