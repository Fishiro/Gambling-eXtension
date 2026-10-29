import { SYMBOLS, TIMING, LEVELS, MINE, MARKET, LUCK, COSMIC, BURN, COMBO, PETS, FARM, GEAR, ITEMS, DROPS, BREWS, RELICS, GEMS, VAULT, VIP } from "./config.js";
import { formatNumber } from "./economy.js";
import { PALETTE, svgIcon } from "./sprites.js";
import { TEXT } from "./text.js";

// The in-game manual: START (four steps), GUIDE (one picture-first card per system), ODDS (every number).
// Pictures carry the explanation; text stays to one short line per idea.

const icon = (name, scale = 3) => svgIcon(name, scale);
const pct = (x) => `${Math.round(x * 100)}%`;
const keycap = (label) => `<kbd>${label}</kbd>`;
const color = (c, text) => `<em style="color:${PALETTE[c]}">${text}</em>`;

// ---- picture parts ----

// The timing bar, drawn on a pixel grid so the zones line up exactly. `cursor` is 0..1, or "sweep" to animate.
function meter(cursor = 0.5) {
    const sweep = cursor === "sweep";
    const x = Math.round((sweep ? 0 : cursor) * 116);
    return `<svg class="g-meter" viewBox="0 0 120 16" shape-rendering="crispEdges" aria-hidden="true">
        <rect x="0" y="3" width="120" height="10" fill="${PALETTE.k}"/>
        <rect x="1" y="4" width="118" height="8" fill="${PALETTE.s}"/>
        <rect x="40" y="4" width="40" height="8" fill="${PALETTE.g}"/>
        <rect x="54" y="4" width="12" height="8" fill="${PALETTE.y}"/>
        <g class="g-cursor${sweep ? " is-sweeping" : ""}" transform="translate(${x} 0)">
            <rect x="0" y="0" width="4" height="16" fill="${PALETTE.k}"/>
            <rect x="1" y="1" width="2" height="14" fill="${PALETTE.w}"/>
        </g>
    </svg>`;
}

// A row of market bars around the x1 line, like the tracker on the mine tab.
function market(prices) {
    const bars = prices
        .map((p, i) => {
            const y = 12 - Math.log2(p) * 12;
            return `<rect x="${i * 6}" y="${Math.min(y, 12).toFixed(1)}" width="4" height="${Math.max(1, Math.abs(y - 12)).toFixed(1)}" fill="${p >= 1 ? PALETTE.G : PALETTE.R}"/>`;
        })
        .join("");
    return `<svg class="g-market" viewBox="0 0 ${prices.length * 6} 24" shape-rendering="crispEdges" aria-hidden="true"><rect x="0" y="12" width="${prices.length * 6}" height="1" fill="${PALETTE.S}"/>${bars}</svg>`;
}

const reels = (symbols, wins = []) =>
    `<span class="g-reels">${symbols.map((s, i) => `<span class="${wins.includes(i) ? "is-win" : ""}">${s ? icon(s, 2) : "<i></i>"}</span>`).join("")}</span>`;

// A row of pictures joined by arrows: "this leads to that".
const flow = (...steps) => `<div class="g-flow">${steps.join(icon("i-next", 2))}</div>`;

// One picture with a short caption under it.
const node = (art, label = "") => `<span class="g-node"><span class="g-art">${art}</span>${label ? `<small>${label}</small>` : ""}</span>`;

// A grid of picture tiles: [art, title, sub].
const tiles = (list, cols = 3) =>
    `<div class="g-tiles" style="--cols:${cols}">${list.map(([art, title, sub = ""]) => `<div class="g-tile">${art}<b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div>`).join("")}</div>`;

const section = (iconName, title, body) => `<section class="g-section"><h4>${icon(iconName, 2)}${title}</h4>${body}</section>`;

const table = (rows) => `<div class="g-table">${rows.map((r) => `<div>${r.map((c) => `<span>${c}</span>`).join("")}</div>`).join("")}</div>`;

// ---- START ----

function startHtml() {
    const steps = [
        [`<span class="g-spin">SPIN</span>`, "1. SPIN", `TAP SPIN OR ${keycap("SPACE")}`],
        [meter("sweep"), "2. STOP ON GOLD", `${color("g", "GREEN")} = GOOD, ${color("y", "GOLD")} = PERFECT`],
        [reels(["seven", "seven", null], [0, 1]), "3. MATCH FROM THE LEFT", "2 OR 3 THE SAME WINS"],
        [flow(icon("i-pick"), icon("ore"), icon("coin")), "4. BROKE? MINE", `TAP THE ROCK, SELL THE ORE`],
    ];
    const keys = [
        [keycap("SPACE"), "SPIN / STOP / SKIP"],
        [`${keycap("H")}${keycap("J")}${keycap("K")}${keycap("L")}`, "MINE"],
        [`${keycap("&lt;")}${keycap("&gt;")}`, "BET"],
        [keycap("A"), "AUTO"],
        [keycap("S"), "SELL ORE"],
        [`${keycap("O")} ${keycap("SHIFT")}${keycap("O")}`, "CHEST / ALL"],
        [`${keycap("1")}-${keycap("4")}`, "TABS"],
        [`${keycap("B")}${keycap("F")}`, "BAG / FORGE"],
        [`${keycap("P")}${keycap("Q")}`, "PETS / SKILL"],
        [keycap("Y"), "HISTORY"],
        [keycap("ESC"), "CLOSE"],
    ];
    return `<p class="g-lead">PLAY IN SHORT BREAKS. THE MINE WORKS WHILE YOU WORK.</p>
        <div class="g-steps">${steps.map(([art, title, text]) => `<div class="g-step"><div class="g-step-art">${art}</div><b>${title}</b><small>${text}</small></div>`).join("")}</div>
        <h3>CONTROLS</h3>
        <div class="g-keys">${keys.map(([k, what]) => `<span>${k}</span><small>${what}</small>`).join("")}</div>
        <button id="btn-guide-play" class="primary g-play" data-fx="y,G,w">LET'S PLAY</button>
        <button id="btn-guide-tour" class="g-tour" data-fx="c,w">${icon("miner", 1)}${TEXT.tourReplay}</button>`;
}

// ---- GUIDE ----

function guideHtml() {
    const g = TIMING.grades;
    const u = MINE.upgrades;
    const top = (list) => list[list.length - 1];
    return [
        section(
            "i-seven",
            "THE SLOT",
            `${flow(node(`<span class="g-spin">SPIN</span>`), node(meter(0.5)), node(reels(["seven", "seven", "seven"], [0, 1, 2])))}
            ${tiles([
                [meter(0.5), color("y", "PERFECT"), `PAYOUT x${g.perfect.mult}`],
                [meter(0.38), color("g", "GOOD"), `PAYOUT x${g.good.mult}`],
                [meter(0.12), "MISS", "PAYOUT x1"],
            ])}
            <p>HIGHER LEVEL = FASTER CURSOR, SMALLER ZONE.</p>`,
        ),
        section(
            "flame",
            "HEAT",
            `<div class="g-flow">${icon("flame").repeat(TIMING.heatMax)}</div>
            <p>+${pct(TIMING.heatStep)} PAYOUT PER HIT IN A ROW. A MISS PUTS IT OUT.</p>`,
        ),
        section(
            "i-pick",
            "MINE",
            `${flow(node(icon("i-pick"), "TAP"), node(icon("ore"), "ORE"), node(icon("i-cart"), "CART"), node(icon("coin"), "SELL"))}
            ${tiles([
                [icon("i-pick"), "PICK", `+${u.pick.step} / TAP`],
                [icon("i-drill"), "DRILL", `+${u.drill.step} / MIN`],
                [icon("i-cart"), "CART", `+${u.cart.step} SPACE`],
            ])}
            <p>THE DRILL KEEPS DIGGING WHILE THE POPUP IS CLOSED.</p>
            <p>SPAM FASTER THAN ~${MINE.overheat.rest} TAPS A SECOND AND THE PICK OVERHEATS: EACH TAP DIGS LESS, DOWN TO ${pct(MINE.overheat.floor)}. EASE OFF A SECOND AND IT COOLS.</p>
            <p>SELLING GIVES ${MINE.xpPerOre} XP PER ORE x THE MARKET PRICE.</p>`,
        ),
        section(
            "coin",
            "MARKET",
            `${flow(node(icon("ore"), "SELL"), node(market([1, 1.2, 1.5, 1.3, 0.8, 0.6, 0.9, 1.1]), "PRICE / MIN"), node(icon("coin"), "ORE x PRICE"))}
            ${tiles(MARKET.phases.map((p) => [`<span class="g-dot" style="--c:${PALETTE[p.color]}"></span>`, color(p.color, p.name), p.drift ? `${p.drift > 0 ? "+" : ""}${pct(p.drift)} / MIN` : "STEADY"]), 5)}
            <p>THE PRICE MOVES EVERY ${MARKET.tickSeconds}S AND ALWAYS DRIFTS BACK TO x1.</p>
            <p>SELL UP TO ${pct(MARKET.demandUpTo)} OF A CART A MINUTE: +${pct(MARKET.demandBump)} NEXT MINUTE. SELL MORE AND THE PRICE SINKS AS YOU SELL, HARDER EACH CART.</p>`,
        ),
        section(
            "flame",
            "COMBO",
            `${tiles(
                COMBO.tiers.slice(1).map((t) => [`<span class="g-dot" style="--c:${PALETTE[t.glow]}"></span>`, color(t.glow, t.name), `x${formatNumber(t.at)}`]),
                4,
            )}
            <p>SPAM ${keycap("H")}${keycap("J")}${keycap("K")}${keycap("L")}. HIGHER TIERS GIVE YOU LESS TIME BETWEEN TAPS.</p>`,
        ),
        section(
            "chest",
            "CHESTS",
            `${flow(node(`${icon("i-seven", 2)}${icon("i-pick", 2)}${icon("bat0", 2)}`, "SPIN / TAP / BAT"), node(icon("chest", 4)), node(icon("chest-open", 4), "LOOT"))}
            ${tiles(LUCK.rarities.map((r) => [icon("chest"), color(r.color, r.name), `${r.weight}%`]), 4)}`,
        ),
        section(
            "cosmic",
            "COSMIC STARS",
            `${tiles([
                [reels(["cherry", "cosmic", "lemon"], [1]), "1 STAR", `+x${COSMIC.single.scatter}`],
                [reels(["cosmic", "cosmic", "bell"], [0, 1]), "2 STARS", `+x${COSMIC.double.scatter} + CHEST`],
                [reels(["cosmic", "cosmic", "cosmic"], [0, 1, 2]), "3 STARS", `x${COSMIC.payout}!`],
            ])}
            <p>PERFECT TIMING DOUBLES THE STAR ODDS.</p>`,
        ),
        section(
            "i-star",
            "LEVELS + BURN",
            `${tiles([
                [icon("i-star"), "LEVEL UP", `+${LEVELS.coinRewardPerLevel} COIN x LV, BIGGER BET`],
                [icon("i-auto"), `LV${LEVELS.autoSpinLevel}`, "AUTO SPIN"],
                [icon("flame"), "BURN", `BETS GIVE UP TO +${pct(top(BURN.tiers).bonus)}`],
            ])}`,
        ),
        section("i-paw", "PETS", `${tiles(PETS.map((p) => [icon(p.id), p.name, formatNumber(p.price)]), 5)}<p>ONE AT A TIME. SKILLS RECHARGE EVEN WHILE CLOSED.</p>`),
        section(
            "i-farm",
            "FARM",
            `${tiles(FARM.zones.map((z) => [icon(z.icon), z.name, `LV${z.level}`]), 4)}
            ${flow(node(icon("seed"), "PLANT"), node(icon("sprout"), `${FARM.crops.seed.minutes} MIN`), node(icon("herb"), "HARVEST"))}`,
        ),
        section(
            "i-bag",
            "FORGE",
            `${flow(node(`${icon("stone", 2)}${icon("iron", 2)}${icon("meteor", 2)}`, "MATERIALS"), node(icon("i-hammer"), "FORGE"), node(`${icon(GEAR[0].icon)}${icon("pstar", 2).repeat(3)}`, "GEAR + STARS"))}
            ${tiles(BREWS.slice(0, 5).map((b) => [icon(b.id), ITEMS[b.id].name]), 5)}
            <p>GEAR IS FOREVER. BREWS ARE ONE-USE BOOSTS.</p>`,
        ),
        section(
            "relic",
            "ENDGAME",
            `${tiles([
                [icon("gem"), "VIP", `${VIP.length - 1} TIERS, BIGGER BETS`],
                [icon("vault"), "THE VAULT", "CRACK ONE A DAY"],
                [icon("relic"), "RELICS", `${RELICS.slots} SLOTS, RANDOM STATS`],
                [icon("kid"), "SKINS", "PAID IN DIAMONDS"],
            ], 4)}`,
        ),
    ].join("");
}

function payHtml() {
    const sym = (id) => icon(id, 2);
    const rows = [...SYMBOLS]
        .reverse()
        .map(
            (s) => `<div class="pt-row">
                <span class="pt-syms">${sym(s.id)}${sym(s.id)}${sym(s.id)}</span><b>x${s.triple}</b>
                <span class="pt-syms">${sym(s.id)}${sym(s.id)}<i class="pt-any"></i></span><b>x${s.pair}</b>
            </div>`,
        )
        .join("");
    return `<p class="g-lead">MATCHES COUNT FROM THE LEFT. PAYOUT = BET x MULTIPLIER x BONUSES.</p>
        <div class="paytable">${rows}</div>
        <div class="pt-row pt-cosmic"><span class="pt-syms">${sym("cosmic")}${sym("cosmic")}${sym("cosmic")}</span><b>x${COSMIC.payout}</b><span>1 IN ${formatNumber(1 / COSMIC.odds[3])}</span></div>
        <div class="pt-row pt-star"><span class="pt-syms">${sym("cosmic")}${sym("cosmic")}<i class="pt-any"></i></span><b>+x${COSMIC.double.scatter}</b><span>ANY 2 REELS</span></div>
        <div class="pt-row pt-star"><span class="pt-syms">${sym("cosmic")}<i class="pt-any"></i><i class="pt-any"></i></span><b>+x${COSMIC.single.scatter}</b><span>ANY REEL, LINE x${COSMIC.single.lineMult}</span></div>`;
}

// ---- ODDS: every number, computed straight from config so it can never drift ----

// 3 decimals for tiny chances, whole numbers otherwise.
const rate = (p) => (p >= 0.1 ? `${Math.round(p * 100)}%` : p >= 0.001 ? `${+(p * 100).toFixed(2)}%` : `1 IN ${formatNumber(Math.round(1 / p))}`);
const totalWeight = (list, w = (x) => x.weight) => list.reduce((sum, x) => sum + w(x), 0);

function slotOddsHtml() {
    const total = totalWeight(SYMBOLS);
    let ret = 0;
    let win = 0;
    const rows = [...SYMBOLS].reverse().map((s) => {
        const p = s.weight / total;
        const triple = p ** 3;
        const pair = p * p * (1 - p);
        ret += triple * s.triple + pair * s.pair;
        win += triple + pair;
        return [icon(s.id, 2), `${s.name} ${rate(p)} / REEL`, `3X ${rate(triple)} = x${s.triple}`, `2X ${rate(pair)} = x${s.pair}`];
    });
    const starRows = [1, 2, 3].map((n) => [
        `${icon("cosmic", 2).repeat(n)}`,
        `${n} STAR${n > 1 ? "S" : ""}`,
        rate(COSMIC.odds[n]),
        `PERFECT: ${rate(COSMIC.odds[n] * COSMIC.perfectMult)}`,
    ]);
    return section(
        "i-seven",
        "SLOT ODDS",
        `<p>EACH REEL ROLLS ON ITS OWN. A PAIR MEANS THE FIRST TWO REELS MATCH.</p>
        ${table(rows)}
        <p>ANY WIN: ${rate(win)} OF SPINS. BASE RETURN: x${ret.toFixed(2)} OF YOUR BET BEFORE TIMING, HEAT, BURN, PETS, GEAR, VIP AND RELICS.</p>
        ${table(starRows)}
        ${table([
            [icon("i-star", 2), "LUCKY SPIN", rate(LUCK.luckySpinChance), `x${LUCK.luckySpinMult} PAYOUT`],
            [icon("chest", 2), "CHEST PER BET SPIN", rate(LUCK.chestPerSpin), "+GEAR / PET / VIP / RELIC CHEST BONUS"],
            [icon("chest", 2), "GEM OR SEVEN TRIPLE", "100%", "A BLESSED CHEST"],
            [icon("gem", 2), "JACKPOT 7-7-7", `+${GEMS.tiers.jackpot} DIAMONDS`, ""],
            [icon("gem", 2), "COSMIC ROLL", `+${GEMS.tiers.cosmic} DIAMONDS`, ""],
        ])}`,
    );
}

function chestOddsHtml() {
    const total = totalWeight(LUCK.rarities);
    const name = (r) => (r.type === "item" ? `${r.n} ${ITEMS[r.id].name}` : r.type === "gems" ? `${r.n} DIAMOND${r.n > 1 ? "S" : ""}` : r.type.toUpperCase());
    return section(
        "chest",
        "CHEST ODDS",
        `<p>A CHEST PICKS A RARITY, THEN ONE REWARD OF THAT RARITY AT EVEN ODDS. BOOSTED CHESTS (BATS, TRIPLES, COSMIC) TILT TOWARD RARE.</p>
        ${table(
            LUCK.rarities.map((r) => {
                const list = LUCK.rewards[r.id];
                return [`<em style="color:${PALETTE[r.color]}">${r.name}</em>`, rate(r.weight / total), list.map(name).join(" / ")];
            }),
        )}
        ${table([
            [icon("ore", 2), "PER MINE TAP", rate(LUCK.chestPerTap), ""],
            [icon("bat0", 2), "GOLDEN BAT", "100%", "BLESSED"],
            [icon("chest", 2), "AWAY", `1 / ${LUCK.awayMinutesPerChest} MIN`, `MAX ${LUCK.awayMaxChests}`],
        ])}`,
    );
}

// Every way to get each item, with the chance.
function itemSources(id) {
    const out = [];
    const DROP_LABELS = { tap: "MINE TAP", luckyTap: "LUCKY TAP", win: "SLOT WIN", star: "COSMIC STAR", bat: "GOLDEN BAT" };
    Object.entries(DROPS).forEach(([src, list]) => list.forEach((d) => d.id === id && out.push(`${DROP_LABELS[src]} ${rate(d.chance)}`)));
    FARM.zones.forEach((z) => {
        const w = z.loot.find(([lid]) => lid === id);
        if (w) out.push(`${z.name} ${rate(w[1] / totalWeight(z.loot, ([, x]) => x))} OF FINDS`);
    });
    Object.entries(FARM.crops).forEach(([seed, crop]) =>
        crop.yields.forEach(([lid, n, p]) => lid === id && out.push(`${ITEMS[seed].name} HARVEST ${rate(p)} (x${n})`)),
    );
    const chestTotal = totalWeight(LUCK.rarities);
    LUCK.rarities.forEach((r) => {
        const list = LUCK.rewards[r.id];
        list.forEach((rw) => rw.type === "item" && rw.id === id && out.push(`CHEST ${rate((r.weight / chestTotal) * (1 / list.length))} (x${rw.n})`));
    });
    if (["relicDust", "stardust", "meteor", "goldfruit"].includes(id)) out.push("THE VAULT");
    if (id === "relicDust") out.push("SALVAGED RELICS");
    if (BREWS.some((b) => b.id === id)) out.push("BREWED IN THE FORGE");
    return out.length ? out.join(" · ") : ITEMS[id].from;
}

function marketOddsHtml() {
    const total = totalWeight(MARKET.phases);
    const dip = (n) => MARKET.dump * Math.max(0, n - MARKET.demandUpTo) ** MARKET.dumpCurve;
    const carts = [MARKET.demandUpTo, 1, 2, 3, 5].map((n) => [icon("i-cart", 2), `${n} CART${n === 1 ? "" : "S"} IN ONE MINUTE`, n <= MARKET.demandUpTo ? `+${MARKET.demandBump} NEXT MIN` : `PRICE -${dip(n).toFixed(2)}`, ""]);
    return section(
        "coin",
        "MARKET",
        `<p>A NEW MOOD IS PICKED WHEN THE LAST ONE ENDS. EACH MINUTE: PRICE += MOOD + NOISE, THEN PULLED BACK TOWARD x1. PRICE STAYS BETWEEN x${MARKET.floor} AND x${MARKET.cap}.</p>
        ${table(MARKET.phases.map((p) => [color(p.color, p.name), rate(p.weight / total), `${p.ticks[0]}-${p.ticks[1]} MIN`, `${p.drift >= 0 ? "+" : ""}${pct(p.drift)} / MIN, PULL ${pct(p.revert)}`]))}
        ${table(carts)}
        <p>THE DIP HITS AS YOU SELL. WHEN THE MINUTE ENDS ${pct(1 - MARKET.stick)} OF IT BOUNCES BACK, THE REST STAYS.</p>`,
    );
}

function itemOddsHtml() {
    return section(
        "i-bag",
        "ITEM DROP RATES",
        `<p>CHANCES ARE PER EVENT. TRIP FINDS: EACH ROLL OF AN EXPEDITION PICKS ONE ITEM BY THESE ODDS. LUCKY TAPS ARE ${rate(MINE.luckyChance)} OF TAPS.</p>
        ${table(Object.keys(ITEMS).map((id) => [icon(id, 2), `<em style="color:${PALETTE[LUCK.rarities.find((r) => r.id === ITEMS[id].rarity).color]}">${ITEMS[id].name}</em>`, itemSources(id)]))}`,
    );
}

function endgameOddsHtml() {
    const relicTotal = totalWeight(RELICS.rarities);
    return section(
        "relic",
        "RELICS, DIAMONDS, VAULT",
        `${table(RELICS.rarities.map((r) => [icon("relic", 2), r.id.toUpperCase(), rate(r.weight / relicTotal), `${r.stats} STAT${r.stats > 1 ? "S" : ""} x${r.mult} / REROLL ${r.reroll} DIAMONDS`]))}
        ${table(RELICS.stats.map((s) => [s.adj, s.label, `+${Math.round(s.min * 100)}-${Math.round(s.max * 100)}% (BEFORE RARITY)`]))}
        ${table([
            [icon("gem", 2), "EPIC / LEGENDARY CHEST", "1 / 5 DIAMONDS", ""],
            [icon("gem", 2), "LUCKY TAP", rate(GEMS.luckyTapChance), "1 DIAMOND"],
            [icon("gem", 2), `EVERY ${GEMS.levelEvery} LEVELS`, `${GEMS.perMilestone} DIAMONDS`, ""],
            [icon("vault", 2), "VAULT HP", `${formatNumber(VAULT.baseHp)} x${VAULT.growth} EACH`, `SPIN: BET x${VAULT.spinGrade.perfect}/${VAULT.spinGrade.good}/${VAULT.spinGrade.miss} + WIN`],
        ])}`,
    );
}

function oddsHtml() {
    return `<p class="g-lead">EVERY CHANCE IN THE GAME, STRAIGHT FROM THE RULES.</p>${[slotOddsHtml(), chestOddsHtml(), marketOddsHtml(), itemOddsHtml(), endgameOddsHtml()].join("")}`;
}

export function buildGuide(onPlay, onTour) {
    document.getElementById("menu-start").innerHTML = startHtml();
    document.getElementById("menu-guide").innerHTML = guideHtml();
    document.getElementById("menu-pay").innerHTML = payHtml() + oddsHtml();
    document.getElementById("btn-guide-play").addEventListener("click", onPlay);
    document.getElementById("btn-guide-tour").addEventListener("click", onTour);
}
