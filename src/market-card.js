import { MARKET } from "./core/config.js";
import { TICK_MS, phaseOf, phaseDef, price, settle, supply, isHot, formatMult } from "./core/market.js";
import { state, commit } from "./store.js";
import * as econ from "./core/economy.js";
import { PALETTE } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

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
        const phase = phaseDef(id);
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
        el.supplyFill.dataset.level = s <= MARKET.demandUpTo ? "low" : s <= MARKET.freeCarts ? "mid" : "high";
        el.supply.textContent = TEXT.marketSold(s.toFixed(1), s <= MARKET.demandUpTo ? "up" : s <= MARKET.freeCarts ? "flat" : "down");
    }

    el.chart.setAttribute("viewBox", `0 0 ${W * 3} ${H}`);
    el.chart.setAttribute("preserveAspectRatio", "none");
    settle(state);
    return { tick, render, hot: () => isHot(state.market) };
}
