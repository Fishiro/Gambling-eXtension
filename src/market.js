import { MARKET } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import { PALETTE } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

// The ore market. state.market.price is the base price, state.market.glut the oversupply from selling;
// what ore actually pays is base * e^-glut (see price). It moves once per tick, run on timestamps like the
// mine, so time away is caught up (up to MARKET.catchUpTicks) when the popup opens.

const TICK_MS = MARKET.tickSeconds * 1000;
const phaseById = Object.fromEntries(MARKET.phases.map((p) => [p.id, p]));
const phaseWeight = MARKET.phases.reduce((sum, p) => sum + p.weight, 0);

export const phaseOf = (m) => phaseById[m.phase] ?? phaseById.calm;

// The price ore sells at right now.
export const price = (m) => m.price * Math.exp(-(m.glut ?? 0));

function rollPhase() {
    let r = Math.random() * phaseWeight;
    const phase = MARKET.phases.find((p) => (r -= p.weight) < 0) ?? MARKET.phases[0];
    const [lo, hi] = phase.ticks;
    return { id: phase.id, left: lo + Math.floor(Math.random() * (hi - lo + 1)) };
}

// One tick: light supply lifts demand, the phase pushes and x1 pulls (a spike phase jumps on its first tick),
// then part of the glut clears. Returns a new phase, if one began.
function step(m, cart) {
    const supply = m.sold / cart;
    let started = null;
    if (m.left <= 0) {
        const next = rollPhase();
        m.phase = next.id;
        m.left = next.left;
        started = next.id;
    }
    const phase = phaseOf(m);
    let base = m.price;
    if (supply > 0 && supply <= MARKET.demandUpTo) base += MARKET.demandBump;
    base += (1 - base) * phase.revert + phase.drift + (Math.random() * 2 - 1) * phase.vol;
    if (started && phase.spike) base = Math.max(base, 1 + phase.spike[0] + Math.random() * (phase.spike[1] - phase.spike[0]));
    m.price = econ.clamp(base, MARKET.floor, MARKET.cap);
    m.glut = (m.glut ?? 0) * MARKET.glutKeep;
    m.left -= 1;
    m.sold = 0;
    m.hist = [...m.hist, price(m)].slice(-MARKET.history);
    return started;
}

// Run every tick that has passed. Returns the phases that began, oldest first.
export function settle(state, now = Date.now()) {
    const m = state.market;
    const ticks = Math.floor((now - m.at) / TICK_MS);
    if (ticks <= 0) return [];
    m.at += ticks * TICK_MS;
    const cart = econ.cartCap(state);
    const started = [];
    for (let i = Math.min(ticks, MARKET.catchUpTicks); i > 0; i--) {
        const phase = step(m, cart);
        if (phase) started.push(phase);
    }
    return started;
}

// Glut from selling `carts` carts in one tick: nothing up to demandUpTo, then faster with every extra cart.
export const glutAt = (carts) => MARKET.dump * Math.max(0, carts - MARKET.demandUpTo) ** MARKET.dumpCurve;

// What selling `amount` ore pays per ore, averaged exactly as e^-glut slides during the sale, and the glut after.
export function quote(state, amount) {
    const m = state.market;
    const cart = econ.cartCap(state);
    const g0 = m.glut ?? 0;
    const g1 = g0 + glutAt((m.sold + amount) / cart) - glutAt(m.sold / cart);
    const mult = g1 > g0 ? (m.price * (Math.exp(-g0) - Math.exp(-g1))) / (g1 - g0) : m.price * Math.exp(-g0);
    return { mult, glut: g1 };
}

// Sell into the market: returns the multiplier paid. Call settle first.
export function sell(state, amount) {
    const { mult, glut } = quote(state, amount);
    state.market.glut = glut;
    state.market.sold += amount;
    return mult;
}

export const supply = (state) => state.market.sold / econ.cartCap(state);

export const formatMult = (x) => `x${x.toFixed(x < 0.1 ? 3 : 2)}`;

// The tracker card on the mine tab: price, change since the last close, phase, a bar chart of
// recent closes (log scale around x1) and how much ore went to market this tick.
export function createMarket() {
    const el = {
        root: $("market"),
        phase: $("mkt-phase"),
        price: $("mkt-price"),
        change: $("mkt-change"),
        next: $("mkt-next"),
        chart: $("mkt-chart"),
        supplyFill: $("mkt-supply-fill"),
        supply: $("mkt-supply"),
    };
    const W = MARKET.history + 1;
    const H = 24;
    const y = (p) => econ.clamp(H / 2 - Math.log2(p) * 16, 0, H);

    function announce(id) {
        const phase = phaseById[id];
        if (!phase.loud || !el.root.offsetParent) return;
        const p = fx.centerOf(el.root);
        fx.float(p.x, p.y - 10, TEXT.marketAlert[id], { color: phase.color, size: 16, rise: 0.3, life: 90 });
        fx.shake(el.root, 3, 400);
        (id === "boom" ? sfx.lucky : sfx.near)();
    }

    // Once a second: run due ticks, then redraw.
    function tick() {
        const started = settle(state);
        if (!started.length) return render();
        commit();
        announce(started[started.length - 1]);
    }

    function chart(m) {
        const points = [...m.hist, price(m)].slice(-W);
        const offset = W - points.length;
        const bars = points
            .map((p, i) => {
                const top = Math.min(y(p), H / 2);
                const h = Math.max(1, Math.abs(y(p) - H / 2));
                const live = i === points.length - 1;
                const c = live ? PALETTE.w : p >= 1 ? PALETTE.G : PALETTE.R;
                return `<rect x="${(offset + i) * 3}" y="${top.toFixed(1)}" width="2" height="${h.toFixed(1)}" fill="${c}"/>`;
            })
            .join("");
        return `<rect x="0" y="${H / 2}" width="${W * 3}" height="0.5" fill="${PALETTE.S}"/>${bars}`;
    }

    function render() {
        const m = state.market;
        const phase = phaseOf(m);
        const last = m.hist[m.hist.length - 1] ?? 1;
        const now = price(m);
        const change = now / last - 1;
        el.root.dataset.phase = phase.id;
        el.root.dataset.trend = now >= 1 ? "up" : "down";
        el.phase.textContent = phase.name;
        el.phase.style.color = PALETTE[phase.color];
        el.price.textContent = formatMult(now);
        el.change.textContent = `${change >= 0 ? "+" : ""}${Math.round(change * 100)}%`;
        el.change.dataset.trend = change >= 0 ? "up" : "down";
        el.next.textContent = TEXT.marketNext(econ.formatClock((m.at + TICK_MS - Date.now()) / 1000));
        el.chart.innerHTML = chart(m);
        const s = supply(state);
        el.supplyFill.style.width = `${Math.min(100, (s / 2) * 100)}%`;
        el.supplyFill.dataset.level = s <= MARKET.demandUpTo ? "low" : s <= 1 ? "mid" : "high";
        el.supply.textContent = TEXT.marketSold(s.toFixed(1));
    }

    el.chart.setAttribute("viewBox", `0 0 ${W * 3} ${H}`);
    el.chart.setAttribute("preserveAspectRatio", "none");
    settle(state);
    return { tick, render, hot: () => Boolean(phaseOf(state.market).spike) || state.market.phase === "boom" };
}
