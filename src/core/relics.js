import { RELICS } from "./config.js";

// Pure relic logic. A relic is { uid, rarity, noun, stats: [{ stat, per }] }; up to RELICS.slots are worn.

const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const statDef = (stat) => RELICS.stats.find((s) => s.stat === stat);

export const rarityDef = (relic) => RELICS.rarities.find((r) => r.id === relic.rarity);

export const relicName = (relic) => `${statDef(relic.stats[0].stat).adj} ${relic.noun}`;

export const statLine = ({ stat, per }) => `+${Math.round(per * 100)}% ${statDef(stat).label}`;

// Different stats per relic; values land between min and max, scaled by rarity.
function rollStats(rarity, rand) {
    const pool = [...RELICS.stats];
    const stats = [];
    for (let i = 0; i < rarity.stats; i++) {
        const def = pool.splice(Math.floor(rand() * pool.length), 1)[0];
        const per = (def.min + rand() * (def.max - def.min)) * rarity.mult;
        stats.push({ stat: def.stat, per: Math.round(per * 100) / 100 });
    }
    return stats;
}

// `floor` is the lowest rarity index allowed (0 rare, 1 epic, 2 legendary).
export function rollRelic(floor = 0, rand = Math.random) {
    const allowed = RELICS.rarities.slice(floor);
    let roll = rand() * allowed.reduce((sum, r) => sum + r.weight, 0);
    const rarity = allowed.find((r) => (roll -= r.weight) < 0) ?? allowed[allowed.length - 1];
    return {
        uid: `${Date.now().toString(36)}${Math.floor(rand() * 1e6).toString(36)}`,
        rarity: rarity.id,
        noun: pick(RELICS.nouns, rand),
        stats: rollStats(rarity, rand),
    };
}

export const reroll = (relic, rand = Math.random) => ({ ...relic, stats: rollStats(rarityDef(relic), rand) });

export const findRelic = (state, uid) => state.relics.list.find((r) => r.uid === uid);

export const isWorn = (state, uid) => state.relics.equipped.includes(uid);

// Adds a relic, or turns it straight into dust when the case is full. Returns the dust made (0 if kept).
export function addRelic(state, relic) {
    if (state.relics.list.length < RELICS.cap) {
        state.relics.list.push(relic);
        return 0;
    }
    const dust = rarityDef(relic).dust;
    state.bag.relicDust = (state.bag.relicDust ?? 0) + dust;
    return dust;
}

export function salvage(state, uid) {
    const relic = findRelic(state, uid);
    if (!relic) return 0;
    unequip(state, uid);
    state.relics.list = state.relics.list.filter((r) => r.uid !== uid);
    const dust = rarityDef(relic).dust;
    state.bag.relicDust = (state.bag.relicDust ?? 0) + dust;
    return dust;
}

export function equip(state, uid) {
    const slot = state.relics.equipped.indexOf(null);
    if (slot < 0 || isWorn(state, uid)) return false;
    state.relics.equipped[slot] = uid;
    return true;
}

export function unequip(state, uid) {
    state.relics.equipped = state.relics.equipped.map((id) => (id === uid ? null : id));
}

export function relicBonus(state, stat) {
    let sum = 0;
    for (const uid of state.relics?.equipped ?? []) {
        const relic = uid && findRelic(state, uid);
        relic?.stats.forEach((s) => s.stat === stat && (sum += s.per));
    }
    return sum;
}
