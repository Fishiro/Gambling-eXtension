import { BREAK_SECONDS, LEVELS } from "./config.js";
import { state, commit, subscribe, wipe } from "./store.js";
import * as econ from "./economy.js";
import { hydrateIcons, svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import * as modal from "./modal.js";
import "./tooltip.js";
import { createSkins } from "./skins.js";
import { createSettings } from "./settings.js";
import { createArmory } from "./armory.js";
import { createVault } from "./vault.js";
import { createBuffs } from "./buffs.js";
import { createUnlocks, tabOpen, viewOpen } from "./unlocks.js";
import { sfx, drone } from "./sound.js";
import { createSlot } from "./slot.js";
import { createMine } from "./mine.js";
import { createMarket } from "./market.js";
import { createGains } from "./gains.js";
import { createChests } from "./chest.js";
import { createHistory } from "./history.js";
import { buildGuide } from "./guide.js";
import { createTutorial } from "./tutorial.js";
import { createPets } from "./pets.js";
import { createAchievements } from "./achievements.js";
import { createBag } from "./bag.js";
import { createFarm } from "./farm.js";
import * as farming from "./farming.js";
import { emit } from "./events.js";
import { TEXT } from "./text.js";
import { $ } from "./ui.js";

const el = {
    tabs: document.querySelectorAll("[data-tab]"),
    panels: { slot: $("tab-slot"), mine: $("tab-mine"), farm: $("tab-farm"), bag: $("tab-bag") },
    coins: $("coins"),
    petButton: $("btn-pet"),
    gems: $("gem-count"),
    wallet: $("wallet"),
    level: $("level"),
    xpFill: $("xp-fill"),
    xpText: $("xp-text"),
    nextUnlock: $("next-unlock"),
    sound: $("btn-sound"),
    menu: $("menu"),
    stats: $("stats"),
    collapse: $("collapse"),
    app: $("app"),
};

hydrateIcons();

const slotTab = document.querySelector('[data-tab="slot"]');
const history = createHistory();
const achievements = createAchievements();
const bag = createBag();
const pets = createPets({ reveal: () => openBag("pets") });
const buffs = createBuffs();
const chests = createChests({ onLevelUp: celebrateLevel, onOpened: history.record });
createSkins();
const armory = createArmory();
const vault = createVault();
const farm = createFarm({ reveal: chests.reveal, onLoot: bag.noteNew, replant: pets.replant });
const slot = createSlot({
    onChest: chests.gain,
    onCosmic: chests.cosmic,
    onLevelUp: celebrateLevel,
    onBroke: () => nudgeTab("mine"),
    onSpin: () => slotTab.classList.toggle("is-spinning", state.tab !== "slot"),
    onResult: reportSlotResult,
    keepHeat: pets.keepHeat,
    refundLoss: pets.refundLoss,
    bendRoll: pets.bendRoll,
});
const mine = createMine({ onLevelUp: celebrateLevel, onChest: chests.gain, onOre: (ore) => vault.damage(ore), pets });
const market = createMarket();
const gains = createGains();

let shownCoins = state.coins;
let coinAnim = 0;

function animateCoins() {
    cancelAnimationFrame(coinAnim);
    const from = shownCoins;
    const to = state.coins;
    if (from === to) return;
    el.wallet.dataset.trend = to > from ? "up" : "down";
    const t0 = performance.now();
    const ms = Math.min(900, 250 + Math.abs(to - from) * 4);
    const step = (now) => {
        const x = econ.clamp((now - t0) / ms, 0, 1);
        shownCoins = Math.round(from + (to - from) * (1 - (1 - x) ** 3));
        el.coins.textContent = econ.formatNumber(shownCoins);
        if (x < 1) coinAnim = requestAnimationFrame(step);
        else delete el.wallet.dataset.trend;
    };
    coinAnim = requestAnimationFrame(step);
}

function renderHud() {
    animateCoins();
    gains.render();
    const need = econ.xpToNext(state.level);
    el.level.textContent = state.level;
    el.gems.textContent = econ.formatNumber(state.gems);
    el.xpFill.style.width = `${Math.min(100, (state.xp / need) * 100)}%`;
    el.xpText.textContent = `${econ.formatNumber(state.xp)} / ${econ.formatNumber(need)}`;
    const next = econ.unlocksAt(state.level + 1);
    el.nextUnlock.textContent = TEXT.nextUnlock(
        state.level + 1,
        next.length ? next : [`+${econ.formatNumber(LEVELS.coinRewardPerLevel * (state.level + 1))} COIN`],
    );
    el.nextUnlock.title = el.nextUnlock.textContent;
    el.sound.innerHTML = svgIcon(state.sound ? "sound" : "mute", 2);
    slotTab.classList.toggle("is-auto", state.auto && state.tab !== "slot");
    renderDots();
}

const DOTS = {
    slot: () => state.freeSpin,
    mine: () => mine.needsAttention() || market.hot(),
    farm: () => farming.needsAttention(state),
    bag: () => bag.needsAttention(),
};

function renderDots() {
    Object.entries(DOTS).forEach(([tab, needs]) => {
        document.querySelector(`[data-dot="${tab}"]`).hidden = state.tab === tab || !needs();
    });
}

function renderStats() {
    const { spins, timed, perfects, bestWin } = state.stats;
    const rows = [
        ["SPINS", econ.formatNumber(spins)],
        ["HIT RATE", spins ? `${Math.round((timed / spins) * 100)}%` : "-"],
        ["PERFECTS", econ.formatNumber(perfects)],
        ["BEST WIN", econ.formatNumber(bestWin)],
        ["LEVEL", state.level],
    ];
    el.stats.innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
}

function setTab(name) {
    if (!tabOpen(name)) return unlocks.deny(unlocks.tabFeature(name), [...el.tabs].find((t) => t.dataset.tab === name));
    state.tab = name;
    slotTab.classList.remove("is-spinning");
    delete slotTab.dataset.result;
    el.tabs.forEach((t) => {
        const on = t.dataset.tab === name;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", String(on));
    });
    Object.entries(el.panels).forEach(([key, panel]) => (panel.hidden = key !== name));
    commit();
    emit(`tab-${name}`);
}

function openBag(view) {
    if (!tabOpen("bag")) return setTab("bag");
    if (!viewOpen(view)) return unlocks.deny(unlocks.viewFeature(view), el.petButton);
    if (state.tab !== "bag") setTab("bag");
    bag.show(view);
}

function nudgeTab(name) {
    const tab = [...el.tabs].find((t) => t.dataset.tab === name);
    fx.shake(tab, 3, 400);
    const p = fx.centerOf(tab);
    fx.burst(p.x, p.y, { count: 10, colors: ["R", "y"], speed: [1, 2.5] });
}

const RESULT_STYLE = {
    win: { color: "G", coins: 3, mood: "win" },
    big: { color: "y", coins: 8, mood: "big" },
    mega: { color: "y", coins: 14, mood: "big" },
    jackpot: { color: "y", coins: 22, mood: "big" },
    cosmic: { color: "v", coins: 40, mood: "big" },
    near: { color: "R", mood: "lose" },
    lose: { color: "R", mood: "lose" },
};

let resultTimer = 0;
function reportSlotResult({ tier, win, bet, grade, symbols }) {
    slotTab.classList.remove("is-spinning");
    achievements.spin({ tier, bet, grade, win, symbols });
    vault.spinHit({ bet, grade, win });
    if (bet) history.record({ type: "spin", tier, win, bet, grade, symbols });
    const style = RESULT_STYLE[tier];
    if (state.tab === "slot" || !style) return;
    // Just above the SLOT button, never over its label.
    const c = fx.centerOf(slotTab);
    const p = { x: c.x, y: c.y - slotTab.offsetHeight / 2 - 12 };
    slotTab.dataset.result = style.mood;
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => delete slotTab.dataset.result, 1100);
    if (style.coins) {
        const label = tier === "win" ? `+${econ.formatNumber(win)}` : `${TEXT.tier[tier]} +${econ.formatNumber(win)}`;
        fx.float(p.x, p.y, label, { color: style.color, size: style.mood === "big" ? 24 : 16, rise: 0.5, life: 80 });
        fx.coinShower(c.x, c.y, style.coins);
        fx.pop(slotTab);
    } else {
        fx.float(p.x, p.y, `-${econ.formatNumber(bet)}`, { color: "l", size: 16, rise: 0.4, life: 50 });
        fx.burst(p.x, p.y, { count: 6, colors: ["r", "s", "S"], speed: [0.5, 1.5], life: [12, 20] });
        fx.shake(slotTab, 2, 220);
    }
}

function celebrateLevel(levels) {
    const top = levels[levels.length - 1];
    const reward = levels.reduce((sum, l) => sum + l.reward, 0);
    const unlocks = levels.flatMap((l) => l.unlocks);
    const gems = levels.reduce((sum, l) => sum + l.gems, 0);
    const p = fx.centerOf(el.level);
    fx.burst(p.x, p.y, { count: 24, colors: ["y", "G", "c", "w"], speed: [1.5, 4] });
    modal.show({
        icon: "star",
        title: TEXT.levelUp(top.level),
        sub: levels.length > 1 ? TEXT.levelsGained(levels.length) : "",
        lines: [
            `${svgIcon("coin", 2)}+${econ.formatNumber(reward)} COIN`,
            ...(gems ? [`${svgIcon("gem", 2)}${TEXT.gemsGained(gems)}`] : []),
            ...unlocks.map((u) => `${svgIcon("next", 2)}${TEXT.unlocked(u)}`),
        ],
        ok: TEXT.levelOk,
        sound: sfx.levelUp,
        confetti: 2,
    });
}

function welcomeBack() {
    const away = (Date.now() - state.lastSeen) / 1000;
    const lines = [];
    const ore = econ.settleOre(state);
    if (ore >= 1) lines.push(`${svgIcon("ore", 2)}${TEXT.welcomeOre(econ.formatNumber(ore))}`);
    if (away >= BREAK_SECONDS && !state.freeSpin) {
        state.freeSpin = true;
        lines.push(`${svgIcon("gift", 2)}${TEXT.breakBonus}`);
    }
    const found = chests.gainWhileAway(away / 60);
    if (found) lines.push(`${svgIcon("chest", 2)}${TEXT.awayChests(found)}`);
    const nap = pets.napInterest(away);
    if (nap) lines.push(`${svgIcon("cat", 2)}${TEXT.napAway(econ.formatNumber(nap))}`);
    const bats = pets.catchWhileAway(state.lastSeen);
    if (bats) lines.push(`${svgIcon("banana", 2)}${TEXT.petsAway(bats)}`);
    const trip = farming.tripStatus(state);
    if (trip?.done) lines.push(`${svgIcon(trip.zone.icon, 2)}${TEXT.tripAway(trip.zone.name)}`);
    const crops = farming.readyPlots(state);
    if (crops) lines.push(`${svgIcon("sprout", 2)}${TEXT.cropsReady(crops)}`);
    state.fun.opens = (state.fun.opens ?? 0) + 1;
    achievements.best("longestAway", away);
    if (!lines.length) return;
    modal.show({
        icon: "chest",
        title: TEXT.welcomeTitle,
        sub: TEXT.awayFor(econ.formatClock(away)),
        lines,
        ok: TEXT.welcomeOk,
        color: "G",
    });
}

function setMenuTab(name) {
    document.querySelectorAll("[data-menu]").forEach((b) => {
        const on = b.dataset.menu === name;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", String(on));
    });
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== name));
    if (name === "stats") renderStats();
    if (name === "trophy") achievements.showList();
    el.menu.scrollTop = 0;
}

function openMenu(tab = "guide") {
    achievements.bump("menu");
    setMenuTab(tab);
    el.menu.hidden = false;
}

function closeMenu() {
    el.menu.hidden = true;
}

el.tabs.forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));
const settings = createSettings({
    startTour: () => {
        closeMenu();
        emit("tour-replay");
        tour.start();
    },
    openGuide: () => setMenuTab("guide"),
    bump: achievements.bump,
});
el.sound.addEventListener("click", settings.toggleSound);
$("btn-menu").addEventListener("click", () => openMenu());
document.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => setMenuTab(b.dataset.menu)));
$("btn-close").addEventListener("click", closeMenu);
// Reset asks in a popup over the dimmed screen; the red button only works with a deliberate click.
$("btn-reset").addEventListener("click", () =>
    modal.show({
        icon: "i-close",
        title: TEXT.resetAsk,
        sub: TEXT.resetWarn,
        lines: TEXT.resetLoses.map(([iconName, text]) => `${svgIcon(iconName, 2)}${text}`),
        columns: 2,
        ok: TEXT.resetYes,
        cancel: TEXT.resetNo,
        danger: true,
        color: "r",
        sound: sfx.denied,
        onOk: collapse,
        onCancel: () => achievements.bump("resetNo"),
    }),
);
$("btn-history").addEventListener("click", () => achievements.bump("history"));

// Reset: wipe first (the store stays frozen), then let the whole UI fall apart before reloading.
function collapse() {
    wipe();
    closeMenu();
    drone.stop();
    sfx.collapse();
    el.app.classList.add("is-collapsing");
    // Dust kicks up along the floor once the app hits the bottom of the popup.
    setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        for (let x = 0; x < w; x += w / 8) {
            fx.burst(x + Math.random() * 20, h - 4, { count: 10, colors: ["S", "s", "l"], angle: -Math.PI / 2, spread: 1.4, speed: [1, 3], gravity: 0.08, life: [30, 60] });
        }
    }, 1500);
    setTimeout(() => (el.collapse.hidden = false), 1900);
    setTimeout(() => location.reload(), 4200);
}

// Button feel: a sound per kind of button, a pixel ripple, a spring on release,
// and the gold frame flares for the buttons that spend or earn.
const PRESS = {
    major: "#btn-spin, #btn-sell, #btn-chest, #btn-chest-all, #loot-all, [data-action='buy'], [data-action='upgrade'], [data-action='brew'], [data-action='send'], [data-action='collect'], [data-action='harvest'], [data-action='harvestAll'], [data-action='skill'], [data-action='use']",
    nav: ".tab, .seg button, [data-menu]",
};

document.addEventListener("pointerdown", (e) => {
    const button = e.target.closest("button");
    if (button?.disabled) {
        sfx.thud();
        return;
    }
    const target = button ?? e.target.closest(".tap");
    if (!target) return;
    const colors = (target.dataset.fx || "w,y").split(",");
    fx.burst(e.clientX, e.clientY, { count: 7, colors, speed: [1, 2.6], life: [12, 22], gravity: 0.1 });
    if (!button) return sfx.click();
    achievements.bump("clicks");
    fx.ripple(e.clientX, e.clientY, colors[0]);
    if (button.matches(PRESS.major)) {
        sfx.clink();
        fx.gild();
    } else if (button.matches(PRESS.nav)) sfx.tab();
    else sfx.click();
});
document.addEventListener("pointerup", (e) => fx.spring(e.target.closest("button:not(:disabled)")));
document.addEventListener("click", (e) => e.target.closest("button")?.blur());

function primaryAction() {
    if (state.tab === "slot") slot.press();
    if (state.tab === "mine") mine.tap();
}

function mineKey() {
    if (state.tab !== "mine") setTab("mine");
    mine.tap();
}

const KEYS = {
    KeyH: mineKey,
    KeyJ: mineKey,
    KeyK: mineKey,
    KeyL: mineKey,
    Space: primaryAction,
    Enter: primaryAction,
    ArrowLeft: () => slot.changeBet(-1),
    ArrowRight: () => slot.changeBet(1),
    Minus: () => slot.changeBet(-1),
    Equal: () => slot.changeBet(1),
    KeyA: () => slot.toggleAuto(),
    KeyS: () => mine.sell(),
    KeyO: (e) => (e.shiftKey ? chests.openAll() : chests.open()),
    KeyY: () => history.open(),
    KeyP: () => pets.open(),
    KeyQ: () => pets.useSkill(),
    Digit1: () => setTab("slot"),
    Digit2: () => setTab("mine"),
    Digit3: () => setTab("farm"),
    Digit4: () => setTab("bag"),
    KeyB: () => openBag("items"),
    KeyF: () => openBag("forge"),
};

document.addEventListener("keydown", (e) => {
    if (e.code === "Escape") achievements.bump("esc");
    if (modal.isOpen()) {
        if (["Space", "Enter", "Escape"].includes(e.code)) {
            e.preventDefault();
            if (!e.repeat) e.code === "Escape" ? modal.close() : modal.confirm(true);
        }
        return;
    }
    if (tour.active() && tour.handleKey(e)) {
        e.preventDefault();
        return;
    }
    if (chests.isOpen()) {
        if (["Space", "Enter", "Escape", "KeyO"].includes(e.code)) {
            e.preventDefault();
            if (!e.repeat) chests.close() || chests.skip();
        }
        return;
    }
    if (history.isOpen()) {
        if (["Escape", "KeyY"].includes(e.code)) history.close();
        return;
    }
    if (!el.menu.hidden) {
        if (e.code === "Escape") closeMenu();
        return;
    }
    const action = KEYS[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;
    action(e);
    achievements.bump("keys");
});
document.addEventListener("keyup", (e) => e.code === "Space" && e.preventDefault());

// Once a second while visible: clock-driven effects, then the live readouts. Anything that must keep
// going while the popup is closed (ore, cooldowns, trips) is derived from timestamps instead.
setInterval(() => {
    if (document.hidden) return;
    if (!tour.active()) {
        pets.tick();
        if (pets.activeId() === "chester") chests.autoOpen(el.petButton);
        mine.updateBat();
    }
    mine.titanTick();
    market.tick();
    unlocks.tick();
    [mine, chests, buffs, pets].forEach((panel) => panel.render());
    farm.tick();
    vault.render();
    renderDots();
    achievements.check();
}, 1000);

// Popup closing: stamp lastSeen so the next open can measure time away.
addEventListener("pagehide", commit);
document.addEventListener("visibilitychange", () => document.hidden && commit());

subscribe(() => {
    renderHud();
    unlocks.apply();
    [vault, armory, slot, mine, market, chests, buffs, pets, bag, farm].forEach((panel) => panel.render());
    achievements.check();
});

const tour = createTutorial({ setTab });
const unlocks = createUnlocks({ tour, stopAuto: () => state.auto && slot.toggleAuto() });
buildGuide(closeMenu, () => {
    closeMenu();
    tour.start();
});
settings.announceImport();
welcomeBack();
pets.tick();
el.coins.textContent = econ.formatNumber(shownCoins);
setTab(tabOpen(state.tab) ? state.tab : "slot");
if (!state.tutorialDone) tour.start();
