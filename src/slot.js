import { BET, TIMING, LUCK, COSMIC, GEMS, BREW_FX } from "./core/config.js";
import { state, commit } from "./store.js";
import * as econ from "./core/economy.js";
import * as luck from "./core/luck.js";
import * as items from "./core/items.js";
import { createReels } from "./reels.js";
import { createMeter } from "./meter.js";
import { svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT, randomLoseLine, randomNearLine, randomFreeRoll } from "./text.js";
import { emit } from "./events.js";
import { $ } from "./ui.js";

const GRADE_COLOR = { perfect: "y", good: "G", miss: "l" };
const FRAME_MS = { lose: 700, free: 600, near: 1000, win: 900, big: 1600, mega: 2400, jackpot: 3200, cosmic: 8000 };
const AUTO_DELAY = { lose: 650, near: 800, free: 650, win: 900, big: 1600, mega: 2400, jackpot: 3200, cosmic: 8000 };
// `buzz`: [px, ms] of side-to-side buzz on the machine. Every tier also lights the machine's rim (see .machine[data-buzz]).
const TIER_FX = {
    win: { count: 350, coins: 4, buzz: [0, 700], sound: "win" },
    big: { count: 900, coins: 12, buzz: [2, 450], sound: "big" },
    mega: { count: 1500, coins: 20, buzz: [2, 700], sound: "big", confetti: 1 },
    jackpot: { count: 2400, coins: 32, buzz: [3, 1000], sound: "jackpot", confetti: 2 },
    cosmic: { count: 4000, coins: 30, buzz: [3, 1400], sound: "cosmic", confetti: 4 },
};
const COSMIC_PULSES = 4;
const COSMIC_PULSE_GAP = 900;

export function createSlot({ onLevelUp, onBroke, onSpin, onResult, onChest, onCosmic, keepHeat, refundLoss, bendRoll, autoGood, doubleWin, onNeedPet }) {
    const el = {
        machine: $("machine"),
        meter: $("meter"),
        heat: $("heat"),
        heatLabel: $("heat-label"),
        headline: $("headline"),
        subline: $("subline"),
        bet: $("bet"),
        betDown: $("bet-down"),
        betUp: $("bet-up"),
        auto: $("btn-auto"),
        spin: $("btn-spin"),
        spinLabel: $("spin-label"),
        spinCost: $("spin-cost"),
        burn: $("burn"),
        burnTier: $("burn-tier"),
        burnValue: $("burn-value"),
        burnFill: $("burn-fill"),
        burnNext: $("burn-next"),
    };

    // While another tab is open (auto spin) the machine is hidden. The win/loss summary by the SLOT dock button
    // belongs to main.js (reportSlotResult), so the machine's own effects stay off; rare news (lucky spin,
    // chests, diamonds) still shows, by the SLOT button, since fx.centerOf points hidden elements there.
    const onScreen = () => Boolean(el.machine.offsetParent);

    const reels = createReels($("reels"), {
        onReelTick: sfx.clack,
        onReelStop(i) {
            sfx.reel(i);
            if (!onScreen()) return;
            const p = reels.reelCenter(i);
            fx.burst(p.x, p.y + 34, { count: 5, colors: ["w", "l"], speed: [0.8, 2], life: [10, 18], gravity: 0.08 });
        },
    });
    const meter = createMeter(el.meter);
    const pips = Array.from({ length: TIMING.heatMax }, () => {
        const pip = document.createElement("i");
        pip.className = "pip";
        pip.innerHTML = svgIcon("flame", 2);
        el.heat.append(pip);
        return pip;
    });

    let phase = "idle";
    let round = null;
    let autoStopTimer = 0;
    let autoTimer = 0;
    let countToken = 0;
    let shownHeat = state.heat;
    let autoMarkup = "";

    // Never above the level's cap, even if the saved bet was set higher.
    const currentBet = () => Math.min(state.bet, econ.maxBet(state));

    // Buzz the machine and light its rim in `tone` for `ms`. Only the machine moves, and only sideways.
    let rimTimer = 0;
    function buzzMachine(tone, power, ms) {
        if (power) fx.buzz(el.machine, power, ms);
        clearTimeout(rimTimer);
        delete el.machine.dataset.buzz;
        void el.machine.offsetWidth;
        el.machine.dataset.buzz = tone;
        rimTimer = setTimeout(() => delete el.machine.dataset.buzz, ms + 200);
    }

    function setMessage(head, sub = "", tone = "") {
        countToken++;
        el.headline.textContent = head;
        el.headline.dataset.tone = tone;
        el.subline.textContent = sub;
    }

    function countUp(prefix, value, ms, tone) {
        const token = ++countToken;
        const t0 = performance.now();
        el.headline.dataset.tone = tone;
        const step = (now) => {
            if (token !== countToken) return;
            const x = econ.clamp((now - t0) / ms, 0, 1);
            el.headline.textContent = `${prefix}+${econ.formatNumber(value * (1 - (1 - x) ** 3))}`;
            if (x < 1) {
                sfx.tick();
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    }

    // The biggest button stop the wallet still covers (0 when it covers none).
    const affordableBet = () => BET.steps.findLast((x) => x > 0 && x <= Math.min(state.coins, currentBet())) ?? 0;

    function spin() {
        const bet = currentBet();
        const free = state.freeSpin && bet > 0;
        if (!free && bet > state.coins) {
            const lower = affordableBet();
            sfx.denied();
            fx.shake(el.spin, 4);
            if (lower) {
                state.bet = lower;
                commit();
                setMessage(TEXT.betLowered(econ.formatNumber(lower)), "", "info");
                fx.pop(el.bet);
                scheduleAuto("lose");
                return;
            }
            setAuto(false);
            setMessage(TEXT.broke, TEXT.brokeSub, "bad");
            onBroke();
            return;
        }

        const burnBefore = econ.burnTier(state.burned);
        if (free) state.freeSpin = false;
        else {
            state.coins -= bet;
            state.burned += bet;
        }
        state.stats.spins++;
        const lucky = bet > 0 && luck.chance(LUCK.luckySpinChance);
        const hot = bet > 0 && state.buffs.hotSpins > 0;
        if (hot) state.buffs.hotSpins--;
        if (bet && luck.timedLeft(state, "phoenix") > 0) state.heat = TIMING.heatMax;
        round = { bet, heat: state.heat, lucky, hot, started: performance.now() };
        phase = "spinning";
        commit();

        sfx.spin();
        fx.frameMode("spin");
        onSpin();
        emit("spin");
        reels.spin();
        meter.start(econ.meterSpec(state.level, state.skill, items.bonus(state, "zone")));
        reels.glow(lucky ? "lucky" : hot ? "hot" : null);
        if (lucky) {
            setMessage(TEXT.luckySpin, TEXT.luckySpinSub(LUCK.luckySpinMult), "big");
            sfx.lucky();
            buzzMachine("lucky", 1, 300);
            const m = fx.centerOf(el.machine);
            fx.burst(m.x, m.y, { count: 30, colors: ["y", "w", "G", "c"], speed: [2, 5], life: [24, 44] });
            fx.float(m.x, m.y - 30, TEXT.luckySpin, { color: "y", size: 24, life: 60 });
        } else {
            setMessage(TEXT.stopPrompt, bet ? `BET ${econ.formatNumber(bet)}${free ? " FREE" : ""}` : TEXT.practice, "prompt");
        }
        if (bet && !free) feedBurn(bet, burnBefore);
        const p = fx.centerOf(el.spin);
        fx.burst(p.x, p.y, { count: 10, colors: free ? ["G", "y", "w"] : ["y", "Y", "w"], speed: [1.5, 3], life: [14, 26] });
        autoStopTimer = setTimeout(() => stop(true), TIMING.autoStopMs);
    }

    async function stop(timedOut) {
        if (phase !== "spinning") return;
        if (!timedOut && performance.now() - round.started < TIMING.minSpinMs) return;
        clearTimeout(autoStopTimer);
        phase = "stopping";
        render();

        let grade = meter.stop(timedOut);
        // SPINNY: an auto spin's stop often lands in the green instead of freezing.
        const steadied = timedOut && state.auto && autoGood();
        if (steadied) grade = "good";
        const rocked = round.bet > 0 && state.buffs.rockSpins > 0;
        if (rocked) {
            state.buffs.rockSpins--;
            grade = "perfect";
        }
        showGrade(grade, timedOut && !rocked && !steadied);
        if (rocked && onScreen()) {
            const p = meter.cursorPoint();
            fx.float(p.x, p.y - 32, TEXT.rockSays, { color: "l", life: 60 });
        }
        emit("stop", { grade, timedOut });
        const starlight = round.bet > 0 && state.buffs.starSpins > 0;
        if (starlight) state.buffs.starSpins--;
        const stars = round.bet > 0 ? econ.rollStars(grade, starlight ? BREW_FX.starMult : 1) : 0;
        const result = econ.placeStars(bendRoll(econ.rollReels(), round.bet), stars);
        const outcome = econ.evaluateSpin(result);
        const cosmic = stars === 3;
        const tease = result[0] === result[1];
        if (cosmic) startCosmic();
        else if (tease) setMessage("...", "", "prompt");
        await reels.stopAt(result, { tease, cosmic });
        settle(grade, outcome, result);
    }

    function startCosmic() {
        reels.glow("cosmic");
        setMessage(TEXT.cosmicBuild, TEXT.cosmicBuildSub, "cosmic");
        sfx.cosmicBuild();
        const m = fx.centerOf(el.machine);
        fx.cosmicStorm(m.y, 7200);
        // The stars align in rising pulses, like a phone ringing harder each time.
        for (let i = 0; i < COSMIC_PULSES; i++) setTimeout(() => buzzMachine("cosmic", 1 + Math.floor(i / 2), 300 + i * 80), i * COSMIC_PULSE_GAP);
    }

    function showGrade(grade, timedOut) {
        ({ perfect: sfx.perfect, good: sfx.good, miss: sfx.miss })[grade]();
        if (!onScreen()) return;
        const p = meter.cursorPoint();
        fx.float(p.x, p.y - 16, timedOut ? TEXT.grade.auto : TEXT.grade[grade], { color: GRADE_COLOR[grade], life: 50 });
        if (grade === "perfect") fx.burst(p.x, p.y, { count: 18, colors: ["y", "w", "G"], speed: [1.5, 3.5] });
        else if (grade === "good") fx.burst(p.x, p.y, { count: 8, colors: ["G", "g", "w"], speed: [1, 2.5] });
    }


    function settle(grade, outcome, symbols) {
        const { bet, heat, lucky, hot } = round;
        const burn = bet ? econ.burnApplied(state.burned, grade) : 0;
        const boost = econ.spinBoost(state, { burn, lucky, hot, midas: luck.timedLeft(state, "midas") > 0 });
        let win = econ.payout(bet, outcome, grade, heat, boost);
        if (bet && doubleWin(win)) win *= 2;
        const tier = bet ? econ.winTier(outcome, win, bet) : "free";
        const shielded = bet && grade === "miss" && state.heat > 0 && keepHeat();
        if (bet && !shielded) state.heat = econ.nextHeat(state.heat, grade);
        state.skill = econ.nextSkill(state.skill, grade);
        if (grade !== "miss") state.stats.timed++;
        if (grade === "perfect") state.stats.perfects++;
        state.coins += win;
        const gems = bet ? (GEMS.tiers[tier] ?? 0) : 0;
        state.gems += gems;
        state.stats.bestWin = Math.max(state.stats.bestWin, win);
        const levels = econ.gainXp(state, econ.spinXp(bet, grade));
        const drops = bet ? [...(win ? items.rollDrops(state, "win") : []), ...(outcome.stars ? items.rollDrops(state, "star") : [])] : [];
        phase = "idle";
        reels.glow(null);
        commit();

        if (tier === "lose" || tier === "near") refundLoss(bet);
        fx.frameMode(tier, FRAME_MS[tier]);
        present(tier, { win, outcome, grade, heat, bet, lucky, hot, burn });
        reels.highlight(outcome.cells);
        if (gems) {
            const m = fx.centerOf(el.machine);
            fx.float(m.x, m.y + (onScreen() ? 30 : -24), TEXT.gemsGained(gems), { color: "c", size: 16, life: 110 });
        }
        if (levels.length) onLevelUp(levels);
        onResult({ tier, win, bet, grade, symbols, kind: outcome.kind });
        emit("settle");
        if (tier === "cosmic") onCosmic(win);
        if (drops.length) emit("drops", { drops, from: el.machine });
        const chest = econ.spinChest(bet, outcome);
        if (chest !== null) onChest(el.machine, chest);
        scheduleAuto(tier);
    }

    function breakdown(outcome, grade, heat, lucky, hot, burn) {
        const parts = [];
        if (outcome.kind === "cosmic") parts.push(`${TEXT.tier.cosmic} x${outcome.mult}`);
        else if (outcome.lineMult) parts.push(`${econ.getSymbol(outcome.symbol).name} ${TEXT.kind[outcome.kind]} x${outcome.lineMult}`);
        if (outcome.stars === 1) parts.push(`STAR +x${COSMIC.single.scatter}${outcome.lineMult ? ` LINE x${COSMIC.single.lineMult}` : ""}`);
        if (outcome.stars === 2) parts.push(`2 STARS +x${COSMIC.double.scatter}`);
        if (grade !== "miss") parts.push(`${grade.toUpperCase()} x${TIMING.grades[grade].mult.toFixed(2)}`);
        if (heat) parts.push(`HEAT x${econ.heatBonus(heat).toFixed(2)}`);
        if (lucky) parts.push(`LUCKY x${LUCK.luckySpinMult}`);
        if (hot) parts.push(`HOT x${LUCK.hotMachineMult}`);
        if (burn) parts.push(`BURN +${econ.formatPercent(burn)}`);
        return parts.join("  ");
    }

    function present(tier, { win, outcome, grade, heat, bet, lucky, hot, burn }) {
        if (tier === "free") {
            setMessage(outcome.mult ? `WOULD WIN x${outcome.mult}` : "+0", randomFreeRoll(), "info");
            return;
        }
        if (tier === "lose") {
            const line = randomLoseLine();
            setMessage(line.head, line.sub, "muted");
            sfx.lose();
            return;
        }
        if (tier === "near") {
            setMessage(randomNearLine(), randomLoseLine().sub, "near");
            sfx.near();
            buzzMachine("near", 1, 220);
            return;
        }

        const cfg = TIER_FX[tier];
        const prefix = tier === "win" ? "" : `${TEXT.tier[tier]} `;
        el.subline.textContent = breakdown(outcome, grade, heat, lucky, hot, burn);
        countUp(prefix, win, cfg.count, tier);
        fx.pop(el.headline);
        sfx[cfg.sound]();
        if (cfg.confetti) fx.confetti(cfg.confetti);
        if (!onScreen()) {
            // Star chests are handed out in presentStars, so it still runs; it skips its own visuals.
            if (outcome.stars && tier !== "cosmic") presentStars(outcome);
            return;
        }
        buzzMachine(tier, ...cfg.buzz);
        outcome.cells.forEach((i) => {
            const p = reels.reelCenter(i);
            fx.coinShower(p.x, p.y, Math.ceil(cfg.coins / outcome.cells.length));
        });
        const p = fx.centerOf(el.machine);
        if (tier === "cosmic") {
            fx.cosmicBurst(p.x, p.y);
            fx.float(p.x, p.y - 50, TEXT.tier.cosmic, { size: 24, rainbow: true, rise: 0.2, life: 160 });
        } else if (outcome.stars) {
            presentStars(outcome);
        }
        fx.float(p.x, p.y - 40, `+${econ.formatNumber(win)}`, { color: tier === "win" ? "G" : "y", size: tier === "win" ? 16 : 24, life: 70 });
        if (bet && win >= bet * 50) fx.burst(p.x, p.y, { count: 40, colors: ["y", "R", "w", "c"], speed: [2, 6], life: [30, 60] });
    }

    function presentStars(outcome) {
        const double = outcome.stars === 2;
        sfx.lucky();
        if (double) {
            sfx.chest();
            fx.cosmicStorm(fx.centerOf(el.machine).y, 1800);
        }
        if (!onScreen()) return;
        outcome.cells.forEach((i) => {
            const p = reels.reelCenter(i);
            fx.burst(p.x, p.y, { count: double ? 40 : 22, colors: ["v", "c", "w", "y"], speed: [1.5, double ? 5 : 3.5], life: [24, 48] });
        });
        const p = fx.centerOf(el.machine);
        fx.float(p.x, p.y - 56, double ? TEXT.doubleStar : TEXT.cosmicStar, { size: double ? 24 : 16, rainbow: true, rise: 0.25, life: 110 });
    }

    function feedBurn(bet, before) {
        const now = econ.burnTier(state.burned);
        if (now.index > before.index) {
            const p = fx.centerOf(el.burn);
            sfx.upgrade();
            fx.burst(p.x, p.y, { count: 40, colors: ["R", "y", "r", "w"], speed: [1.5, 4.5], life: [24, 44] });
            fx.float(p.x, p.y - 16, `${now.tier.name}!`, { color: "R", size: 24, life: 90 });
            fx.shake(el.burn, 3, 300);
        }
        if (!onScreen()) return;
        const from = fx.centerOf(el.spin);
        const to = fx.centerOf(el.burnValue);
        fx.burst(from.x, from.y - 10, { count: 8, colors: ["R", "y", "r"], angle: Math.atan2(to.y - from.y, to.x - from.x), spread: 0.5, speed: [4, 7], gravity: 0, drag: 0.93, life: [14, 22] });
        fx.burst(to.x, to.y, { count: 6, colors: ["R", "y"], speed: [0.5, 1.5], angle: -Math.PI / 2, spread: 1.2, gravity: -0.05, life: [14, 26] });
        const gain = econ.burnBonus(state.burned) - econ.burnBonus(state.burned - bet);
        if (gain > 0) fx.float(to.x, to.y - 12, `+${econ.formatPercent(gain)}`, { color: "R", size: 8, rise: 0.5, life: 40 });
        fx.pop(el.burnValue);
    }

    function scheduleAuto(tier) {
        clearTimeout(autoTimer);
        if (!state.auto || !econ.canAutoSpin(state)) return;
        autoTimer = setTimeout(() => {
            if (state.auto && phase === "idle") spin();
        }, AUTO_DELAY[tier] ?? 700);
    }

    function setAuto(on) {
        state.auto = on && econ.canAutoSpin(state);
        commit();
        if (state.auto && phase === "idle") scheduleAuto("lose");
        else clearTimeout(autoTimer);
    }

    function renderHeat() {
        pips.forEach((pip, i) => pip.classList.toggle("is-on", i < state.heat));
        el.heatLabel.textContent = state.heat ? `x${econ.heatBonus(state.heat).toFixed(2)}` : "HEAT";
        const row = el.heat.closest(".meter-row");
        if (state.heat) row.dataset.hot = state.heat >= TIMING.heatMax ? "max" : "on";
        else delete row.dataset.hot;
        if (state.heat > shownHeat) {
            const pip = pips[state.heat - 1];
            fx.pop(pip);
            const p = fx.centerOf(pip);
            fx.burst(p.x, p.y, { count: 8, colors: ["R", "y", "r"], speed: [0.8, 2], angle: -Math.PI / 2, spread: 1.4, gravity: -0.04, life: [16, 28] });
        }
        shownHeat = state.heat;
    }

    function render() {
        const bet = currentBet();
        const idle = phase === "idle";
        const free = state.freeSpin && bet > 0;
        // While the player types, the field is theirs.
        if (document.activeElement !== el.bet) el.bet.value = econ.formatNumber(bet);
        el.bet.readOnly = !idle;
        el.bet.title = TEXT.betCap(econ.formatNumber(econ.maxBet(state)));
        el.betDown.disabled = !idle || bet === 0;
        el.betUp.disabled = !idle || bet >= econ.maxBet(state);

        el.spin.dataset.mode = !idle ? (phase === "spinning" ? "stop" : "busy") : free ? "free" : bet ? "spin" : "practice";
        el.spinLabel.textContent = phase === "spinning" ? TEXT.stop : phase === "stopping" ? TEXT.skip : free && idle ? TEXT.freeSpin : TEXT.spin;
        el.spinCost.innerHTML = !idle ? "" : free ? svgIcon("gift", 2) : bet ? `${svgIcon("coin", 2)}${econ.formatNumber(bet)}` : TEXT.practice;

        const unlocked = econ.canAutoSpin(state);
        const markup = unlocked ? `${svgIcon("auto", 2)}AUTO` : `${svgIcon("spinny", 2)}${TEXT.autoLocked}`;
        if (markup !== autoMarkup) el.auto.innerHTML = autoMarkup = markup;
        el.auto.dataset.locked = String(!unlocked);
        el.auto.title = unlocked ? "" : TEXT.autoNeeds;
        el.auto.classList.toggle("is-on", state.auto && unlocked);
        el.auto.setAttribute("aria-pressed", String(state.auto && unlocked));
        renderHeat();
        const burn = econ.burnTier(state.burned);
        el.burnTier.textContent = burn.tier.name;
        el.burnValue.textContent = `+${econ.formatPercent(econ.burnBonus(state.burned))}`;
        el.burnFill.style.width = `${burn.progress * 100}%`;
        el.burnNext.textContent = burn.next ? `${burn.next.name} IN ${econ.formatNumber(burn.toNext)}` : TEXT.burnMax;
        el.burn.dataset.tier = burn.index;
    }

    function setBet(next) {
        state.bet = next;
        commit();
        emit("bet-change");
        fx.pop(el.bet);
    }

    function changeBet(delta) {
        if (phase !== "idle") return;
        const next = econ.stepBet(state, currentBet(), delta);
        if (next === currentBet()) {
            emit("bet-stuck", { delta });
            sfx.denied();
            fx.shake(el.bet.parentElement, 2, 200);
            return;
        }
        setBet(next);
    }

    // A typed bet ("2500", "2.5K", "1M"): clamped to the cap, with a word when it was too high.
    function typeBet() {
        const wanted = econ.parseBet(el.bet.value);
        el.bet.blur();
        if (phase !== "idle" || Number.isNaN(wanted)) return render();
        const next = econ.clampBet(state, wanted);
        if (next < wanted) {
            sfx.denied();
            const p = fx.centerOf(el.bet);
            fx.float(p.x, p.y - 18, TEXT.betCap(econ.formatNumber(next)), { color: "R", life: 70 });
        }
        if (next !== state.bet) setBet(next);
        render();
    }

    el.spin.addEventListener("click", () => press());
    el.betDown.addEventListener("click", () => changeBet(-1));
    el.bet.addEventListener("focus", () => el.bet.select());
    el.bet.addEventListener("change", typeBet);
    // Keys typed into the bet must not drive the game; Enter confirms, Escape gives up.
    el.bet.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") typeBet();
        if (e.key === "Escape") {
            el.bet.value = "";
            el.bet.blur();
            render();
        }
    });
    el.betUp.addEventListener("click", () => changeBet(1));
    el.auto.addEventListener("click", () => toggleAuto());
    $("reels").addEventListener("pointerdown", () => phase === "spinning" && stop(false));
    el.meter.addEventListener("pointerdown", () => phase === "spinning" && stop(false));

    setMessage(TEXT.ready, TEXT.hint);
    if (state.auto) scheduleAuto("lose");

    function press() {
        if (phase === "spinning") stop(false);
        else if (phase === "stopping") reels.rush();
        else if (phase === "idle") spin();
    }

    // Without SPINNY on the team, AUTO says so and opens the pets instead.
    function toggleAuto() {
        if (econ.canAutoSpin(state)) return setAuto(!state.auto);
        sfx.denied();
        fx.shake(el.auto, 2, 200);
        const p = fx.centerOf(el.auto);
        fx.float(p.x, p.y - 18, TEXT.autoNeeds, { color: "c", life: 70 });
        onNeedPet();
    }

    return { press, changeBet, toggleAuto, render };
}
