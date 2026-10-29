import { MARKET } from "./config.js";
import { clamp, cartCap } from "./economy.js";

// The ore market. state.market.price is the base price, glut the oversupply players piled up and drag the
// part of it the price already feels; ore pays base * e^-drag (see price). It only moves once per tick, run on
// timestamps like the mine, so time away is caught up (up to MARKET.catchUpTicks) when the popup opens.

export const TICK_MS = MARKET.tickSeconds * 1000;
const phaseById = Object.fromEntries(MARKET.phases.map((p) => [p.id, p]));
const phaseWeight = MARKET.phases.reduce((sum, p) => sum + p.weight, 0);

export const phaseOf = (m) => phaseById[m.phase] ?? phaseById.calm;
export const phaseDef = (id) => phaseById[id];

// The price ore sells at right now.
export const price = (m) => m.price * Math.exp(-(m.drag ?? 0));

function rollPhase(rand) {
    let r = rand() * phaseWeight;
    const phase = MARKET.phases.find((p) => (r -= p.weight) < 0) ?? MARKET.phases[0];
    const [lo, hi] = phase.ticks;
    return { id: phase.id, left: lo + Math.floor(rand() * (hi - lo + 1)) };
}

// Glut from selling `carts` carts in one tick: nothing up to freeCarts, then faster with every extra cart.
export const glutAt = (carts) => MARKET.dump * Math.max(0, carts - MARKET.freeCarts) ** MARKET.dumpCurve;

// One tick: this tick's sales become glut (or lift demand if light), the phase pushes, x1 pulls, a jolt may
// kick (a spike phase jumps on its first tick), drag eases toward the glut, then part of the glut clears.
// Returns a new phase, if one began.
export function step(m, cart, rand = Math.random) {
    const supply = m.sold / cart;
    let started = null;
    if (m.left <= 0) {
        const next = rollPhase(rand);
        m.phase = next.id;
        m.left = next.left;
        started = next.id;
    }
    const phase = phaseOf(m);
    m.glut = (m.glut ?? 0) + glutAt(supply);
    let base = m.price;
    if (supply > 0 && supply <= MARKET.demandUpTo) base += MARKET.demandBump;
    base += (1 - base) * phase.revert + phase.drift + (rand() * 2 - 1) * phase.vol;
    if (rand() < MARKET.jolt.chance) base += (rand() < 0.5 ? -1 : 1) * MARKET.jolt.size * (0.4 + rand() * 0.6);
    if (started && phase.spike) base = Math.max(base, 1 + phase.spike[0] + rand() * (phase.spike[1] - phase.spike[0]));
    m.price = clamp(base, MARKET.floor, MARKET.cap);
    m.drag = (m.drag ?? 0) + (m.glut - (m.drag ?? 0)) * MARKET.dragRate;
    m.glut *= MARKET.glutKeep;
    m.left -= 1;
    m.sold = 0;
    m.hist = [...m.hist, price(m)].slice(-MARKET.history);
    return started;
}

// Run every tick that has passed. Returns the phases that began, oldest first.
export function settle(state, now = Date.now(), rand = Math.random) {
    const m = state.market;
    const ticks = Math.floor((now - m.at) / TICK_MS);
    if (ticks <= 0) return [];
    m.at += ticks * TICK_MS;
    const cart = cartCap(state);
    const started = [];
    for (let i = Math.min(ticks, MARKET.catchUpTicks); i > 0; i--) {
        const phase = step(m, cart, rand);
        if (phase) started.push(phase);
    }
    return started;
}

// Everything sold within a tick pays that tick's price; selling only shapes the ticks after it.
export const quote = (state) => ({ mult: price(state.market) });

// Sell into the market: returns the multiplier paid. Call settle first.
export function sell(state, amount) {
    state.market.sold += amount;
    return price(state.market);
}

// STONKS' PUMP IT: the glut is wiped and the base price jumps by `amount`.
export function pump(state, amount) {
    settle(state);
    state.market.glut = 0;
    state.market.drag = 0;
    state.market.price = Math.min(MARKET.cap, state.market.price + amount);
}

export const supply = (state) => state.market.sold / cartCap(state);

// A hot market (a spike or a boom) is worth a dot on the MINE tab.
export const isHot = (m) => Boolean(phaseOf(m).spike) || m.phase === "boom";

export const formatMult = (x) => `x${x.toFixed(x < 0.1 ? 3 : 2)}`;
