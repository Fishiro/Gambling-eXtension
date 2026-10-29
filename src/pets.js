import { PETS, LUCK } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import * as luck from "./luck.js";
import * as items from "./items.js";
import * as farming from "./farming.js";
import { svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { emit, on } from "./events.js";
import { $ } from "./ui.js";

const byId = Object.fromEntries(PETS.map((p) => [p.id, p]));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const petById = (id) => byId[id];

// Skills are timestamps, not timers: a skill is ready once Date.now() passes readyAt.
const readyAt = (id) => state.pets.readyAt[id] ?? 0;
const cooldownLeft = (id) => Math.max(0, readyAt(id) - Date.now()) / 1000;
const owns = (id) => state.pets.owned.includes(id);

const cooldownOf = (id) => byId[id].cooldown * Math.max(0.3, 1 - items.bonus(state, "petCd"));

export function createPets({ reveal }) {
    const el = {
        button: $("btn-pet"),
        list: $("pet-list"),
    };

    const cards = PETS.map((pet) => {
        const card = document.createElement("div");
        card.className = "pet-card";
        card.innerHTML = `
            <span class="pet-art">${svgIcon(pet.id, 4)}</span>
            <div class="pet-info">
                <b>${pet.name}</b>
                <small class="pet-kind">${pet.kind} / ${pet.skill}${pet.auto ? " (AUTO)" : ""}</small>
                <p>${pet.desc}</p>
                ${pet.passive ? `<small class="pet-passive">${TEXT.petPassive(pet.passive)}</small>` : ""}
                <small class="pet-cd"></small>
            </div>
            <div class="pet-actions"></div>`;
        const actions = card.querySelector(".pet-actions");
        actions.addEventListener("click", (e) => {
            const action = e.target.closest("button")?.dataset.action;
            if (action) ACTIONS[action](pet, e.target.closest("button"));
        });
        card.querySelector(".pet-art").addEventListener("click", (e) => owns(pet.id) && pat(e.clientX, e.clientY, pet.id));
        el.list.append(card);
        return { pet, card, actions, cd: card.querySelector(".pet-cd"), markup: "" };
    });

    const active = () => (state.pets.active ? byId[state.pets.active] : null);

    function ready(id) {
        return state.pets.active === id && cooldownLeft(id) <= 0;
    }

    // Consume the active pet's skill if it is ready. Returns true when it fired.
    function trigger(id) {
        if (!ready(id)) return false;
        state.pets.readyAt[id] = Date.now() + cooldownOf(id);
        emit("skill", { id });
        return true;
    }

    function shout(text, color = "y") {
        const p = fx.centerOf(el.button);
        fx.float(p.x, p.y + 20, text, { color, rise: 0.4, life: 70 });
        fx.pop(el.button);
    }

    function pat(x, y, id = state.pets.active) {
        const pet = byId[id];
        if (!pet) return;
        state.fun.pats = (state.fun.pats ?? 0) + 1;
        sfx.pet();
        fx.burst(x, y, { count: 6, colors: ["R", "r", "w"], speed: [0.8, 2], angle: -Math.PI / 2, spread: 1.2, gravity: -0.03, life: [16, 30] });
        if (Math.random() < 0.35) fx.float(x, y - 18, pick(pet.lines), { color: "w", rise: 0.3, life: 60 });
        emit("pat", { id });
        commit();
    }

    function useSkill() {
        const pet = active();
        if (!pet) return reveal();
        if (pet.auto) {
            sfx.denied();
            return shout(TEXT.petAuto, "l");
        }
        if (!trigger(pet.id)) {
            sfx.denied();
            return shout(econ.formatClock(cooldownLeft(pet.id)), "l");
        }
        if (pet.id === "toaster") {
            econ.addOre(state, econ.cartCap(state));
            luck.applyReward(state, { type: "goldRush", seconds: pet.rushSeconds });
        }
        if (pet.id === "rock") state.buffs.rockSpins += pet.perfectSpins;
        if (pet.id === "dice") state.buffs.loadedSpins += pet.loadedSpins;
        if (pet.id === "digit7") state.buffs.sevenSpins = 1;
        if (pet.id === "hourglass") farming.skipTime(state, pet.skipMinutes * 60_000);
        commit();
        sfx.upgrade();
        shout(`${pet.skill}!`);
        fx.confetti(1);
    }

    const ACTIONS = {
        buy(pet, button) {
            if (state.coins < pet.price) {
                sfx.denied();
                fx.shake(button, 2, 200);
                return;
            }
            const p = fx.centerOf(button.closest(".pet-card").querySelector(".pet-art"));
            econ.settleOre(state);
            state.coins -= pet.price;
            state.pets.owned.push(pet.id);
            state.pets.active = pet.id;
            commit();
            sfx.levelUp();
            fx.confetti(1);
            fx.burst(p.x, p.y, { count: 30, colors: ["y", "G", "w", "R"], speed: [1.5, 4], life: [20, 40] });
            fx.float(p.x, p.y - 20, TEXT.petHello(pet.name), { color: "y", life: 80 });
            emit("pet-buy", { id: pet.id, price: pet.price });
        },
        equip(pet) {
            econ.settleOre(state);
            state.pets.active = pet.id;
            commit();
            sfx.upgrade();
            emit("pet-equip", { id: pet.id });
        },
        pat(pet, button) {
            const p = fx.centerOf(button);
            pat(p.x, p.y, pet.id);
        },
        skill: () => useSkill(),
    };

    function cooldownText(pet) {
        const left = cooldownLeft(pet.id);
        return left > 0 ? TEXT.petCooldown(econ.formatClock(left)) : TEXT.petReady;
    }

    function renderCard(c) {
        const { pet, card, actions, cd } = c;
        const owned = owns(pet.id);
        const isActive = state.pets.active === pet.id;
        card.dataset.state = isActive ? "active" : owned ? "owned" : "locked";
        cd.textContent = owned ? cooldownText(pet) : "";
        let markup;
        if (!owned) {
            markup = `<button data-action="buy" data-fx="y,G,w" ${state.coins < pet.price ? "disabled" : ""}>${svgIcon("coin", 2)}${econ.formatNumber(pet.price)}</button>`;
        } else if (!isActive) {
            markup = `<button data-action="equip" data-fx="c,w">${TEXT.petEquip}</button>`;
        } else {
            const skill = pet.auto ? "" : `<button data-action="skill" class="pet-skill" data-fx="y,R,w" ${cooldownLeft(pet.id) > 0 ? "disabled" : ""}>${TEXT.petUse}</button>`;
            markup = `${skill}<button data-action="pat" data-fx="R,r,w">${svgIcon("heart", 2)}${TEXT.petPat}</button>`;
        }
        if (markup !== c.markup) actions.innerHTML = c.markup = markup;
    }

    function render() {
        const pet = active();
        let markup;
        if (!pet) markup = `${svgIcon("i-paw", 2)}${TEXT.pets}`;
        else {
            const left = cooldownLeft(pet.id);
            markup = `${svgIcon(pet.id, 2)}<span>${left > 0 ? econ.formatClock(left) : pet.auto ? TEXT.petOn : TEXT.petReady}</span>`;
            el.button.dataset.ready = String(left <= 0);
        }
        if (!pet) delete el.button.dataset.ready;
        if (markup !== el.button.innerHTML) el.button.innerHTML = markup;
        if (el.list.offsetParent) cards.forEach(renderCard);
    }

    // Auto skills that only need a clock: run on open and on every display tick.
    function tick() {
        if (state.freeSpin || !trigger("berry")) return;
        state.freeSpin = true;
        state.buffs.hotSpins += byId.berry.hotSpins;
        commit();
        sfx.chest();
        shout(TEXT.berrySpin, "G");
    }

    // Pets that bend the next bet spin's reels: SEVEN's sure 7-7-7, Dicey's loaded die, SIX's every 6th spin.
    function bendRoll(rolled, bet) {
        if (!bet) return rolled;
        if (state.buffs.sevenSpins > 0) {
            state.buffs.sevenSpins--;
            shout(TEXT.sevenHeaven, "R");
            return ["seven", "seven", "seven"];
        }
        let roll = rolled;
        if (state.buffs.loadedSpins > 0) {
            state.buffs.loadedSpins--;
            roll = econ.loadDice(roll);
        }
        if (state.pets.active === "digit6") {
            state.pets.sixCount = (state.pets.sixCount ?? 0) + 1;
            if (state.pets.sixCount % byId.digit6.every === 0) {
                roll = econ.loadDice(roll);
                shout(TEXT.sixShot, "c");
            }
        }
        return roll;
    }

    // Oinker: refund part of a lost bet. Returns the refund.
    function refundLoss(bet) {
        if (!bet || !trigger("piggy")) return 0;
        const refund = Math.round(bet * byId.piggy.refund);
        state.coins += refund;
        sfx.coin();
        shout(TEXT.piggyRefund(econ.formatNumber(refund)), "G");
        return refund;
    }

    // Spore: replant a just-harvested plot with the same seed.
    function replant(index, seed) {
        if (!items.count(state, seed) || !trigger("shroom")) return false;
        return farming.plant(state, index, seed);
    }

    // Meemee's nap interest for time away, from timestamps like everything else offline.
    function napInterest(awaySeconds) {
        const cat = byId.cat;
        if (state.pets.active !== "cat" || awaySeconds < cat.napMinMinutes * 60) return 0;
        const rate = Math.min(cat.napCap, (awaySeconds / 3600) * cat.napPerHour);
        const gain = Math.floor(state.coins * rate);
        state.coins += gain;
        state.fun.napCoins = (state.fun.napCoins ?? 0) + gain;
        return gain;
    }

    function keepHeat() {
        if (!trigger("bonsai")) return false;
        sfx.good();
        shout(TEXT.zenRoots, "G");
        return true;
    }

    // Banana catches bats while the popup is closed: one per cooldown, worked out from timestamps.
    function catchWhileAway(awaySince) {
        if (state.pets.active !== "banana") return 0;
        const now = Date.now();
        const start = Math.max(readyAt("banana"), awaySince + LUCK.batMeanSeconds * 1000);
        if (start > now) return 0;
        const cooldown = cooldownOf("banana");
        const { awayMaxBats, catchBoost } = byId.banana;
        const catches = Math.min(awayMaxBats, 1 + Math.floor((now - start) / cooldown));
        let added = 0;
        for (let i = 0; i < catches; i++) if (luck.addChest(state, catchBoost)) added++;
        state.pets.readyAt.banana = start + catches * cooldown;
        state.fun.bats = (state.fun.bats ?? 0) + added;
        return added;
    }

    el.button.addEventListener("click", reveal);
    on("bag-view", ({ view }) => view === "pets" && cards.forEach(renderCard));

    return {
        render,
        tick,
        open: reveal,
        ready,
        trigger,
        keepHeat,
        refundLoss,
        bendRoll,
        replant,
        napInterest,
        pat,
        useSkill,
        catchWhileAway,
        activeId: () => state.pets.active,
    };
}
