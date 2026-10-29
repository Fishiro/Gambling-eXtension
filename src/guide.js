import { SYMBOLS, TIMING, LEVELS, MINE, MARKET, LUCK, COSMIC, BURN, COMBO, PETS, PET_ROLES, PET_SLOTS, FARM, GEAR, STAR_CHANCE, ITEMS, DROPS, BREWS, RELICS, GEMS, VAULT, VIP } from "./core/config.js";
import { formatNumber, lineOdds } from "./core/economy.js";
import { PALETTE, svgFit } from "./sprites.js";
import { TEXT } from "./text.js";
import { HOTKEYS } from "./keys.js";

// The in-game manual: START (four steps), GUIDE (one picture-first card per system), ODDS (every chance,
// one folding card per system).
// Pictures carry the explanation; text stays to one short line per idea.

// `size` 3 = a 24px box, 2 = 16px, 1 = 8px; every sprite sits in that fixed square (see svgFit), so they match.
const icon = (name, size = 3) => svgFit(name, size * 8);
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

// A grid of picture tiles: [art, title, sub]. Every tile keeps the sub line (empty or not), so all tiles in
// the manual are one size.
const tiles = (list, cols = 3) =>
    `<div class="g-tiles" style="--cols:${cols}">${list.map(([art, title, sub = ""]) => `<div class="g-tile"><span class="g-tile-art">${art}</span><b>${title}</b><small>${sub}</small></div>`).join("")}</div>`;

const section = (iconName, title, body) => `<section class="g-section"><h4>${icon(iconName, 2)}${title}</h4>${body}</section>`;


// ---- START ----

function startHtml() {
    const steps = [
        [`<span class="g-spin">SPIN</span>`, "1. SPIN", `TAP SPIN OR ${keycap("SPACE")}`],
        [meter("sweep"), "2. STOP ON GOLD", `${color("g", "GREEN")} = GOOD, ${color("y", "GOLD")} = PERFECT`],
        [reels(["seven", "seven", null], [0, 1]), "3. MATCH FROM THE LEFT", "2 OR 3 THE SAME WINS"],
        [flow(icon("i-pick"), icon("ore"), icon("coin")), "4. BROKE? MINE", `TAP THE ROCK, SELL THE ORE`],
    ];
    // Straight from keys.js. Mining on the MINE tab with SPACE is already covered by SPACE's own row.
    const caps = (list) => list.map(keycap).join("");
    const keys = HOTKEYS.filter((k) => !(k.group === "mine" && k.caps[0] === "SPACE")).map((k) => [k.alt ? `${caps(k.caps)} ${caps(k.alt)}` : caps(k.caps), k.label]);
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
                [icon("i-pick"), "PICK", `ORE / TAP`],
                [icon("i-drill"), "DRILL", `ORE / MIN`],
                [icon("i-cart"), "CART", `SPACE`],
            ])}
            <p>EVERY UPGRADE LEVEL ADDS A STEP AND GROWS THE WHOLE VALUE BY ${pct(u.pick.compound - 1)}, SO BIG LEVELS STAY WORTH BUYING.</p>
            <p>THE DRILL KEEPS DIGGING WHILE THE POPUP IS CLOSED.</p>
            <p>SPAM FASTER THAN ~${MINE.overheat.rest} TAPS A SECOND AND THE PICK OVERHEATS: EACH TAP DIGS LESS, DOWN TO ${pct(MINE.overheat.floor)}. EASE OFF A SECOND AND IT COOLS.</p>
            <p>SELLING GIVES A LITTLE XP: EVERYTHING SOLD IN ONE MARKET MINUTE COUNTS AS ONE SALE, SO SPAMMING SELL EARNS NO MORE THAN ONE BIG SALE.</p>`,
        ),
        section(
            "coin",
            "MARKET",
            `${flow(node(icon("ore"), "SELL"), node(market([1, 1.2, 1.5, 1.3, 0.8, 0.6, 0.9, 1.1]), "PRICE / MIN"), node(icon("coin"), "ORE x PRICE"))}
            ${tiles(MARKET.phases.map((p) => [`<span class="g-dot" style="--c:${PALETTE[p.color]}"></span>`, color(p.color, p.name), p.spike ? `+${pct(p.spike[0])}-${pct(p.spike[1])}!` : p.drift ? `${p.drift > 0 ? "+" : ""}${pct(p.drift)} / MIN` : "STEADY"]), 3)}
            <p>THE PRICE MOVES EVERY ${MARKET.tickSeconds}S AND ALWAYS DRIFTS BACK TO x1.</p>
            <p>WHAT YOU SELL PAYS THIS MINUTE'S PRICE. UP TO ${pct(MARKET.demandUpTo)} OF A CART: +${pct(MARKET.demandBump)} NEXT MINUTE. OVER ${MARKET.freeCarts} CART A MINUTE: THE PRICE SLIDES DOWN OVER THE NEXT MINUTES. KEEP DUMPING AND IT HITS PENNIES.</p>`,
        ),
        section(
            "flame",
            "COMBO",
            `${tiles(
                COMBO.tiers.slice(1).map((t) => [`<span class="g-dot" style="--c:${PALETTE[t.glow]}"></span>`, color(t.glow, t.name), `x${formatNumber(t.at)}`]),
                4,
            )}
            <p>SPAM ${HOTKEYS.find((k) => k.group === "mine").caps.map(keycap).join("")}. HIGHER TIERS GIVE YOU LESS TIME BETWEEN TAPS.</p>`,
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
                [icon("spinny"), "AUTO SPIN", "SPINNY ON YOUR PET TEAM"],
                [icon("flame"), "BURN", `BETS GIVE UP TO +${pct(top(BURN.tiers).bonus)}`],
            ])}`,
        ),
        section(
            "i-paw",
            "PETS",
            `${tiles(Object.entries(PET_ROLES).map(([id, r]) => [`${PETS.filter((p) => p.role === id).map((p) => icon(p.id, 2)).join("")}`, color(r.color, r.name), r.desc]), 3)}
            ${tiles(PETS.map((p) => [icon(p.id), p.name, formatNumber(p.price)]), 5)}
            <p>UP TO ${PET_SLOTS.length} ON YOUR TEAM, ALL WORKING AT ONCE. SLOT 2 COSTS ${PET_SLOTS[1]} DIAMONDS, SLOT 3 COSTS ${PET_SLOTS[2]}. SKILLS RECHARGE EVEN WHILE CLOSED.</p>`,
        ),
        section(
            "i-farm",
            "FARM",
            `${tiles(FARM.zones.map((z) => [icon(z.icon), z.name, `LV${z.level}`]), 4)}
            ${tiles(FARM.trips.map((t) => [icon("i-clock"), t.label, `${Math.round(t.luck * 100)}% LUCK`]), 4)}
            <p>LONGER TRIPS ARE LUCKIER: RARE, EPIC AND LEGENDARY FINDS SHOW UP MORE.</p>
            ${tiles(FARM.stances.map((s) => [icon(s.id === "delve" ? "crystal" : s.id === "forage" ? "wood" : "i-clock"), s.name, `x${s.rolls} FINDS, x${s.luck} LUCK`]), 3)}
            ${tiles(FARM.party.map((m, n) => [n ? PETS.slice(0, n).map(() => icon("i-paw", 2)).join("") : icon("miner", 2), n ? `${n} PET${n > 1 ? "S" : ""}` : "DIGGS ALONE", `x${m} FINDS`]), 4)}
            <p>PETS ON A TRIP LEAVE YOUR TEAM UNTIL YOU COLLECT. CHEAP BUDDIES ARE PERFECT FOR THIS.</p>
            ${flow(node(icon("seed"), "PLANT"), node(icon("sprout"), `${FARM.crops.seed.minutes} MIN`), node(icon("herb"), "HARVEST"))}`,
        ),
        section(
            "i-bag",
            "FORGE",
            `${flow(node(`${icon("stone", 2)}${icon("iron", 2)}${icon("meteor", 2)}`, "MATERIALS"), node(icon("i-hammer"), "FORGE"), node(`${icon(GEAR[0].icon)}${icon("pstar", 2).repeat(3)}`, "GEAR + STARS"))}
            ${tiles(BREWS.slice(0, 5).map((b) => [icon(b.id), ITEMS[b.id].name]), 5)}
            <p>GEAR IS FOREVER. BREWS ARE ONE-USE BOOSTS.</p>
            ${tiles(STAR_CHANCE.map((p, i) => [icon("pstar", 2).repeat(i + 1), `STAR ${i + 1}`, `${pct(p)} WORKS`]), 5)}
            <p>A FAILED STAR COSTS THE PRICE AND CRACKS ONE STAR OFF. EVERY CRAFT ALSO COSTS COINS.</p>
            ${tiles(BREWS.filter((b) => b.combo).map((b) => [icon(b.id), ITEMS[b.id].name, ITEMS[b.id].effect]), 3)}
            <p>COMBO BREWS ARE MADE FROM JUNK. EACH STAYS SECRET UNTIL YOU HAVE FOUND ALL ITS INGREDIENTS ONCE.</p>`,
        ),
        section(
            "relic",
            "ENDGAME",
            `${tiles([
                [icon("gem"), "VIP", `${VIP.length - 1} TIERS, BIGGER PAYOUTS`],
                [icon("vault"), "THE VAULT", "CRACK ONE A DAY"],
                [icon("relic"), "RELICS", `${RELICS.slots} SLOTS, RANDOM STATS`],
                [icon("kid"), "SKINS", "PAID IN DIAMONDS"],
            ], 4)}`,
        ),
    ].join("");
}

// ---- ODDS: every chance in the game, computed straight from config so it can never drift ----
// Each system is one folding card: a picture-first takeaway on top, the numbers inside. Every chance is
// written the same way (see odds) and drawn as a bar, so nothing needs reading twice.

const totalWeight = (list, w = (x) => x.weight) => list.reduce((sum, x) => sum + w(x), 0);

// One way to say a chance everywhere: plain % when common, "1 IN N" when rare, both in between.
function odds(p) {
    if (p >= 1) return "ALWAYS";
    if (p >= 0.1) return `${Math.round(p * 100)}%`;
    const one = `1 IN ${formatNumber(Math.round(1 / p))}`;
    return p >= 0.01 ? `${+(p * 100).toFixed(1)}% · ${one}` : one;
}

// The short form for small chips under an icon: "5.3%" or "1 IN 113".
const brief = (p) => (p >= 1 ? "100%" : p >= 0.01 ? `${+(p * 100).toFixed(1)}%` : `1 IN ${formatNumber(Math.round(1 / p))}`);

// A chance as a bar. Rare chances get a log scale so 1 in 7,000 still shows a sliver next to 1 in 4.
const bar = (p, c = "y") => `<span class="o-bar"><i style="width:${Math.max(3, Math.min(100, p >= 0.01 ? p * 100 : 3 + Math.log10(p * 1e4) * 4))}%;background:${PALETTE[c]}"></i></span>`;

// One line: picture, what it is (and a hint), the chance in words and as a bar.
const row = (art, label, p, { note = "", c = "y", value } = {}) => `<div class="o-row">
        <span class="o-art">${art}</span>
        <span class="o-what"><b>${label}</b>${note ? `<small>${note}</small>` : ""}</span>
        <span class="o-odds"><b>${value ?? odds(p)}</b>${p === null ? "" : bar(p, c)}</span>
    </div>`;

// A whole distribution as one bar split into colored parts: [{ p, c, label }].
const stack = (parts) => `<div class="o-stack">${parts.map(({ p, c }) => `<i style="flex:${p};background:${PALETTE[c]}"></i>`).join("")}</div>
    <div class="o-key">${parts.map(({ p, c, label }) => `<span><i style="background:${PALETTE[c]}"></i>${label} ${Math.round(p * 100)}%</span>`).join("")}</div>`;

const sub = (text) => `<h5 class="o-sub">${text}</h5>`;

// A folding card: icon, title and a one-line takeaway; the numbers open underneath.
const card = (iconName, title, takeaway, body, open = false) => `<details class="o-card" ${open ? "open" : ""}>
        <summary><span class="o-head-art">${icon(iconName, 3)}</span><span><b>${title}</b><small>${takeaway}</small></span><i class="o-chev">${icon("i-next", 2)}</i></summary>
        <div class="o-body">${body}</div>
    </details>`;

function slotOdds() {
    const odds = lineOdds();
    let win = 0;
    const rows = [...SYMBOLS].reverse().flatMap((s) => {
        const { triple, pair } = odds[s.id];
        win += triple + pair;
        return [
            row(reels([s.id, s.id, s.id], [0, 1, 2]), `3 ${s.name}`, triple, { note: `PAYS x${s.triple}`, c: "y" }),
            row(reels([s.id, s.id, null], [0, 1]), `2 ${s.name}`, pair, { note: `PAYS x${s.pair}`, c: "G" }),
        ];
    });
    const g = TIMING.grades;
    const body = `${sub("WHAT PAYS (MATCH FROM THE LEFT)")}
        ${rows.join("")}
        ${sub("COSMIC STARS (ANY REEL)")}
        ${row(reels(["cherry", "cosmic", "lemon"], [1]), "1 STAR", COSMIC.odds[1], { note: `+x${COSMIC.single.scatter}, LINE x${COSMIC.single.lineMult}`, c: "v" })}
        ${row(reels(["cosmic", "cosmic", "bell"], [0, 1]), "2 STARS", COSMIC.odds[2], { note: `+x${COSMIC.double.scatter}, BLESSED CHEST`, c: "v" })}
        ${row(reels(["cosmic", "cosmic", "cosmic"], [0, 1, 2]), "3 STARS", COSMIC.odds[3], { note: `x${COSMIC.payout}!`, c: "v" })}
        <p class="o-tip">${icon("i-star", 2)} A PERFECT STOP DOUBLES EVERY STAR CHANCE.</p>
        ${sub("YOUR TIMING MULTIPLIES THE WIN")}
        ${tiles([
            [meter(0.5), color("y", "PERFECT"), `WIN x${g.perfect.mult}`],
            [meter(0.38), color("g", "GOOD"), `WIN x${g.good.mult}`],
            [meter(0.12), "MISS", "WIN x1"],
        ])}
        ${sub("EXTRAS ON EVERY BET SPIN")}
        ${row(icon("i-star", 3), "LUCKY SPIN", LUCK.luckySpinChance, { note: `THIS SPIN PAYS x${LUCK.luckySpinMult}` })}
        ${row(icon("chest", 3), "A CHEST DROPS", LUCK.chestPerSpin, { note: "ANY BET, AT MOST ONE A SPIN" })}
        ${row(reels(["seven", "seven", "seven"], [0, 1, 2]), "JACKPOT 7-7-7", null, { value: `+${GEMS.tiers.jackpot} ${icon("gem", 2)}` })}`;
    return card("i-seven", "SLOT", `ABOUT 1 SPIN IN ${Math.round(1 / win)} WINS SOMETHING`, body, true);
}

const REWARD_ART = {
    coins: (r) => [icon("coin", 3), `${formatNumber(r.mult * LUCK.coinPerLevel)} x LV`],
    ore: (r) => [icon("ore", 3), `ORE ${Math.round(r.fill * 100)}% CART`],
    xp: (r) => [icon("i-star", 3), `XP ${Math.round(r.frac * 100)}%`],
    item: (r) => [icon(r.id, 3), `${r.n} ${ITEMS[r.id].name}`],
    freeSpin: () => [icon("i-gift", 3), "FREE SPIN"],
    heat: (r) => [icon("flame", 3), `+${r.amount} HEAT`],
    goldRush: (r) => [icon("ore", 3), `GOLD RUSH ${r.seconds}S`],
    hotMachine: (r) => [icon("flame", 3), `${r.spins} HOT SPINS`],
    gems: (r) => [icon("gem", 3), `${r.n} DIAMOND${r.n > 1 ? "S" : ""}`],
    bundle: () => [icon("chest", 3), "CHEST BUNDLE"],
    relic: () => [icon("relic", 3), "A RELIC"],
};

function chestOdds() {
    const total = totalWeight(LUCK.rarities);
    const legendary = LUCK.rarities[LUCK.rarities.length - 1];
    const body = `${sub("A CHEST PICKS A RARITY...")}
        ${stack(LUCK.rarities.map((r) => ({ p: r.weight / total, c: r.color, label: r.name })))}
        ${sub("...THEN ONE OF ITS REWARDS, EVEN ODDS")}
        ${LUCK.rarities
            .map((r) => {
                const list = LUCK.rewards[r.id];
                return `<div class="o-rewards o-rewards-grid"><b style="color:${PALETTE[r.color]}"><span class="o-head-art">${icon("chest", 3)}</span>${r.name}<small>EACH ${brief(1 / list.length)}</small></b>
                    <span>${list.map((rw) => REWARD_ART[rw.type](rw)).map(([art, label]) => `<span class="o-chip is-label">${art}<small>${label}</small></span>`).join("")}</span></div>`;
            })
            .join("")}
        ${sub("WHERE CHESTS COME FROM")}
        ${row(icon("i-pick", 3), "EVERY MINE TAP", LUCK.chestPerTap)}
        ${row(icon("i-seven", 3), "EVERY BET SPIN", LUCK.chestPerSpin, { note: "ANY BET. GEM/7 TRIPLE: BLESSED" })}
        ${row(icon("bat0", 3), "GOLDEN BAT", 1, { note: "A BLESSED CHEST: BETTER RARITY" })}
        ${row(icon("i-clock", 3), "WHILE AWAY", null, { value: `1 / ${LUCK.awayMinutesPerChest} MIN`, note: `UP TO ${LUCK.awayMaxChests}` })}`;
    return card("chest", "CHESTS", `MOSTLY COMMON. ABOUT 1 IN ${Math.round(total / legendary.weight)} IS ${legendary.name}`, body);
}

function marketOdds() {
    const total = totalWeight(MARKET.phases);
    const mood = (p) => (p.spike ? `JUMPS +${pct(p.spike[0])}-${pct(p.spike[1])}` : p.drift > 0 ? `+${pct(p.drift)} EACH MIN` : p.drift < 0 ? `${pct(p.drift)} EACH MIN` : "STAYS NEAR x1");
    const glut = (n) => MARKET.dump * Math.max(0, n - MARKET.freeCarts) ** MARKET.dumpCurve;
    const next = (n) => (n <= MARKET.demandUpTo ? color("G", "GOES UP A BIT") : n <= MARKET.freeCarts ? color("l", "STAYS STEADY") : glut(n) < 0.5 ? color("y", "DIPS SLOWLY") : glut(n) < 2 ? color("R", "DIPS") : color("r", "CRASHES"));
    const body = `${sub("THE PRICE MOVES ONCE A MINUTE, IN MOODS")}
        ${stack(MARKET.phases.map((p) => ({ p: p.weight / total, c: p.color, label: p.name })))}
        ${MARKET.phases.map((p) => row(`<span class="g-dot" style="--c:${PALETTE[p.color]}"></span>`, color(p.color, p.name), p.weight / total, { note: `${mood(p)} · ${p.ticks[0] === p.ticks[1] ? p.ticks[0] : p.ticks.join("-")} MIN`, c: p.color })).join("")}
        ${row(icon("flame", 3), "SURPRISE JOLT", MARKET.jolt.chance, { note: `ANY MINUTE, UP OR DOWN ${pct(MARKET.jolt.size)}` })}
        ${sub("WHAT SELLING DOES TO THE NEXT MINUTES")}
        ${[MARKET.demandUpTo, MARKET.freeCarts, 2, 3, 9].map((n) => row(`${icon("i-cart", 3)}<small>x${n}</small>`, `${n} CART${n === 1 ? "" : "S"} A MINUTE`, null, { value: next(n) })).join("")}
        <p class="o-tip">${icon("coin", 2)} YOU ALWAYS GET THIS MINUTE'S PRICE. A BIG DUMP ONLY BITES IN THE MINUTES AFTER, AND FADES AGAIN.</p>`;
    return card("coin", "ORE MARKET", `SELL ABOUT ${MARKET.freeCarts} CART A MINUTE AND THE PRICE STAYS HEALTHY`, body);
}

function tripOdds() {
    const maxLuck = FARM.trips[FARM.trips.length - 1].luck;
    const boost = (rank) => (maxLuck ** (rank * FARM.luckCurve)).toFixed(1);
    const zoneParts = (zone) => {
        const total = totalWeight(zone.loot, ([, w]) => w);
        return zone.loot.map(([id, w]) => `<span class="o-chip" data-tip="${id}">${icon(id, 3)}<small>${brief(w / total)}</small></span>`).join("");
    };
    const body = `${sub("LONGER TRIPS ARE LUCKIER")}
        ${FARM.trips.map((t) => row(icon("i-clock", 3), t.label, t.luck / maxLuck, { value: `${Math.round(t.luck * 100)}% LUCK`, note: `~${t.rolls} FINDS ALONE`, c: "G" })).join("")}
        <p class="o-tip">${icon("i-star", 2)} AT ${Math.round(maxLuck * 100)}% LUCK: RARE FINDS x${boost(1)}, EPIC x${boost(2)}, LEGENDARY x${boost(3)} AS LIKELY.</p>
        ${sub("MORE PETS CARRY MORE LOOT")}
        ${tiles(FARM.party.map((m, n) => [`<span class="o-icons">${n ? icon("i-paw", 2).repeat(n) : icon("miner", 2)}</span>`, n ? `${n} PET${n > 1 ? "S" : ""}` : "DIGGS ALONE", `x${m} FINDS`]), 4)}
        ${sub("WHAT EACH ZONE DROPS (AT 100% LUCK)")}
        ${FARM.zones.map((z) => `<div class="o-rewards"><b><span class="o-head-art">${icon(z.icon, 3)}</span>${z.name}<small>LV${z.level}</small></b><span>${zoneParts(z)}</span></div>`).join("")}`;
    return card("i-farm", "EXPEDITIONS", `${FARM.trips[FARM.trips.length - 1].label} IS THE LUCKIEST. EACH PET ADDS LOOT`, body);
}

const DROP_SOURCES = [
    ["tap", `<span class="o-head-art">${icon("i-pick", 3)}</span>`, "MINE TAP", "EVERY TAP"],
    ["luckyTap", `<span class="o-head-art">${icon("i-star", 3)}</span>`, "LUCKY TAP", `${brief(MINE.luckyChance)} OF TAPS`],
    ["win", `<span class="o-head-art">${icon("i-seven", 3)}</span>`, "SLOT WIN", "EVERY WIN"],
    ["star", `<span class="o-head-art">${icon("cosmic", 3)}</span>`, "COSMIC STAR", "EVERY STAR"],
    ["bat", `<span class="o-head-art">${icon("bat0", 3)}</span>`, "GOLDEN BAT", "EVERY BAT"],
];

function itemOdds() {
    const sources = DROP_SOURCES.map(([src, art, label, note]) => `<div class="o-rewards"><b>${art}${label}<small>${note}</small></b><span>${DROPS[src].map((d) => `<span class="o-chip" data-tip="${d.id}">${icon(d.id, 3)}<small>${brief(d.chance)}</small></span>`).join("")}</span></div>`).join("");
    const crops = Object.entries(FARM.crops)
        .map(([seed, crop]) => `<div class="o-rewards"><b><span class="o-head-art">${icon(seed, 3)}</span>${ITEMS[seed].name}<small>${crop.minutes} MIN</small></b><span>${crop.yields.map(([id, n, p]) => `<span class="o-chip" data-tip="${id}">${icon(id, 3)}<small>${n > 1 ? `x${n} ` : ""}${brief(p)}</small></span>`).join("")}</span></div>`)
        .join("");
    const body = `${sub("DROPS WHILE YOU PLAY (CHANCE EACH TIME)")}
        ${sources}
        ${sub("GARDEN HARVESTS")}
        ${crops}
        <p class="o-tip">${icon("i-bag", 2)} HOVER AN ITEM FOR ITS NAME. THE BAG SHOWS EVERY PLACE IT COMES FROM.</p>`;
    return card("i-bag", "ITEM DROPS", "TAPS, WINS AND BATS DROP MATERIALS. TRIPS BRING THE REST", body);
}

function rareOdds() {
    const relicTotal = totalWeight(RELICS.rarities);
    const relicColor = { rare: "B", epic: "v", legendary: "y" };
    const lucky = MINE.luckyChance * GEMS.luckyTapChance;
    const body = `${sub("DIAMONDS")}
        ${row(icon("i-pick", 3), "ANY MINE TAP", lucky, { note: "A LUCKY TAP THAT SPARKLES", c: "c" })}
        ${row(reels(["seven", "seven", "seven"], [0, 1, 2]), "JACKPOT 7-7-7", null, { value: `+${GEMS.tiers.jackpot} ${icon("gem", 2)}` })}
        ${row(reels(["cosmic", "cosmic", "cosmic"], [0, 1, 2]), "COSMIC ROLL", null, { value: `+${GEMS.tiers.cosmic} ${icon("gem", 2)}` })}
        ${row(icon("i-star", 3), `EVERY ${GEMS.levelEvery} LEVELS`, null, { value: `+${GEMS.perMilestone} ${icon("gem", 2)}` })}
        ${row(icon("chest", 3), "EPIC / LEGENDARY CHEST", null, { value: `1 / 5 ${icon("gem", 2)}`, note: "WHEN THAT REWARD COMES UP" })}
        ${sub("RELICS: HOW RARE")}
        ${stack(RELICS.rarities.map((r) => ({ p: r.weight / relicTotal, c: relicColor[r.id], label: r.id.toUpperCase() })))}
        ${tiles(RELICS.rarities.map((r) => [icon("relic"), color(relicColor[r.id], r.id.toUpperCase()), `${r.stats} STAT${r.stats > 1 ? "S" : ""}, x${r.mult} STRONG`]))}
        ${sub("THE VAULT")}
        ${row(icon("vault", 3), "FIRST VAULT OF THE DAY", null, { value: `${formatNumber(VAULT.baseHp)} HP`, note: `EACH NEXT ONE x${VAULT.growth} TOUGHER` })}
        ${row(icon("i-seven", 3), "A SPIN HITS FOR", null, { value: `BET x${VAULT.spinGrade.perfect}/${VAULT.spinGrade.good}/${VAULT.spinGrade.miss}`, note: "PERFECT / GOOD / MISS, PLUS THE WIN" })}`;
    return card("gem", "DIAMONDS, RELICS, VAULT", `ABOUT ${odds(lucky)} MINE TAPS FINDS A DIAMOND`, body);
}

function oddsHtml() {
    const legend = `<div class="o-legend">
            <span><b>100%</b><small>ALWAYS</small></span>
            <span><b>25%</b><small>1 TIME IN 4</small></span>
            <span><b>1 IN 1,000</b><small>VERY RARE</small></span>
        </div>`;
    return `<p class="g-lead">EVERY CHANCE IN THE GAME. TAP A CARD TO OPEN IT.</p>
        ${legend}
        ${[slotOdds(), chestOdds(), marketOdds(), tripOdds(), itemOdds(), rareOdds()].join("")}`;
}

export function buildGuide(onPlay, onTour) {
    document.getElementById("menu-start").innerHTML = startHtml();
    document.getElementById("menu-guide").innerHTML = guideHtml();
    document.getElementById("menu-pay").innerHTML = oddsHtml();
    document.getElementById("btn-guide-play").addEventListener("click", onPlay);
    document.getElementById("btn-guide-tour").addEventListener("click", onTour);
}
