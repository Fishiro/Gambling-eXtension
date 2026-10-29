import { PETS, PET_SLOTS, PET_ROLES, LUCK } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import * as luck from "./luck.js";
import * as items from "./items.js";
import * as farming from "./farming.js";
import * as market from "./market.js";
import { PALETTE, svgIcon } from "./sprites.js";
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
const equipped = (id) => state.pets.team.includes(id);
const teamFull = () => state.pets.team.length >= state.pets.slots;

const cooldownOf = (id) => byId[id].cooldown * Math.max(0.3, 1 - items.bonus(state, "petCd"));

// The team: up to state.pets.slots pets at once. Every equipped pet's skill and passive work together.
export function createPets({ reveal, showFarm }) {
    const el = {
        button: $("btn-pet"),
        list: $("pet-list"),
    };

    const team = document.createElement("div");
    team.className = "pet-team";
    team.addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        if (button.dataset.unequip) ACTIONS.unequip(byId[button.dataset.unequip]);
        else if (button.dataset.slot) buySlot(button);
    });
    el.list.append(team);

    const cards = PETS.map((pet) => {
        const role = PET_ROLES[pet.role];
        const card = document.createElement("div");
        card.className = "pet-card";
        card.innerHTML = `
            <span class="pet-art">${svgIcon(pet.id, 4)}</span>
            <div class="pet-info">
                <b>${pet.name}<em class="pet-role" style="--tone:${PALETTE[role.color]}">${role.name}</em></b>
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

    const members = () => state.pets.team.map((id) => byId[id]).filter(Boolean);

    function ready(id) {
        return equipped(id) && cooldownLeft(id) <= 0;
    }

    // Consume an equipped pet's skill if it is ready. Returns true when it fired.
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

    function pat(x, y, id = state.pets.team[0]) {
        const pet = byId[id];
        if (!pet) return;
        state.fun.pats = (state.fun.pats ?? 0) + 1;
        sfx.pet();
        fx.burst(x, y, { count: 6, colors: ["R", "r", "w"], speed: [0.8, 2], angle: -Math.PI / 2, spread: 1.2, gravity: -0.03, life: [16, 30] });
        if (Math.random() < 0.35) fx.float(x, y - 18, pick(pet.lines), { color: "w", rise: 0.3, life: 60 });
        emit("pat", { id });
        commit();
    }

    // Q / USE: fire `id`'s skill, or with no id the first tap skill on the team that is ready.
    function useSkill(id) {
        const tappers = members().filter((p) => !p.auto);
        if (!state.pets.team.length) return reveal();
        if (!tappers.length) {
            sfx.denied();
            return shout(TEXT.petAuto, "l");
        }
        const pet = id ? byId[id] : (tappers.find((p) => cooldownLeft(p.id) <= 0) ?? tappers[0]);
        if (!trigger(pet.id)) {
            sfx.denied();
            return shout(`${pet.name} ${econ.formatClock(cooldownLeft(pet.id))}`, "l");
        }
        if (pet.id === "toaster") {
            econ.addOre(state, econ.cartCap(state));
            luck.applyReward(state, { type: "goldRush", seconds: pet.rushSeconds });
        }
        if (pet.id === "frosty") luck.applyReward(state, { type: "timed", key: "freeze", seconds: pet.freezeSeconds, label: pet.skill });
        if (pet.id === "stonks") market.pump(state, pet.pump);
        if (pet.id === "rock") state.buffs.rockSpins += pet.perfectSpins;
        if (pet.id === "dice") state.buffs.loadedSpins += pet.loadedSpins;
        if (pet.id === "digit7") state.buffs.sevenSpins = 1;
        if (pet.id === "hourglass") farming.skipTime(state, pet.skipMinutes * 60_000);
        commit();
        sfx.upgrade();
        shout(`${pet.skill}!`);
        fx.confetti(1);
    }

    function equip(pet, button) {
        if (equipped(pet.id)) return;
        if (farming.isAway(state, pet.id)) {
            sfx.denied();
            return shout(TEXT.petBusy, "l");
        }
        if (teamFull()) {
            sfx.denied();
            if (button) fx.shake(button, 2, 200);
            return shout(TEXT.teamFull(state.pets.slots), "l");
        }
        econ.settleOre(state);
        state.pets.team = [...state.pets.team, pet.id];
        commit();
        sfx.upgrade();
        emit("pet-equip", { id: pet.id });
    }

    // The next locked team slot, paid in diamonds.
    function buySlot(button) {
        const cost = PET_SLOTS[state.pets.slots];
        if (cost === undefined) return;
        if (state.gems < cost) {
            sfx.denied();
            return fx.shake(button, 2, 200);
        }
        state.gems -= cost;
        state.pets.slots += 1;
        commit();
        sfx.levelUp();
        const p = fx.centerOf(button);
        fx.burst(p.x, p.y, { count: 30, colors: ["c", "B", "w"], speed: [1.5, 4], life: [20, 40] });
        fx.float(p.x, p.y - 16, TEXT.slotOpened, { color: "c", life: 80 });
        emit("pet-slot", { slots: state.pets.slots });
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
            if (!teamFull()) state.pets.team = [...state.pets.team, pet.id];
            commit();
            sfx.levelUp();
            fx.confetti(1);
            fx.burst(p.x, p.y, { count: 30, colors: ["y", "G", "w", "R"], speed: [1.5, 4], life: [20, 40] });
            fx.float(p.x, p.y - 20, TEXT.petHello(pet.name), { color: "y", life: 80 });
            emit("pet-buy", { id: pet.id, price: pet.price });
        },
        equip,
        unequip(pet) {
            econ.settleOre(state);
            state.pets.team = state.pets.team.filter((id) => id !== pet.id);
            if (pet.id === "spinny" && state.auto) state.auto = false;
            commit();
            sfx.tab();
        },
        pat(pet, button) {
            const p = fx.centerOf(button);
            pat(p.x, p.y, pet.id);
        },
        skill: (pet) => useSkill(pet.id),
        detail: () => showFarm(),
    };

    function cooldownText(pet) {
        const left = cooldownLeft(pet.id);
        return left > 0 ? TEXT.petCooldown(econ.formatClock(left)) : TEXT.petReady;
    }

    function renderTeam() {
        const { slots } = state.pets;
        const markup = PET_SLOTS.map((cost, i) => {
            const id = state.pets.team[i];
            if (i < slots && id) return `<button class="pet-slot is-on" data-unequip="${id}" title="${TEXT.petRemove}">${svgIcon(id, 2)}<small>${byId[id].name}</small></button>`;
            if (i < slots) return `<span class="pet-slot is-empty">${TEXT.empty}</span>`;
            const next = i === slots;
            return `<button class="pet-slot is-locked" ${next ? `data-slot="${i}"` : "disabled"} ${next && state.gems < cost ? 'data-poor=""' : ""}>${svgIcon(next ? "gem" : "lock", 2)}<small>${next ? cost : TEXT.slotLocked}</small></button>`;
        }).join("");
        if (team.innerHTML !== markup) team.innerHTML = markup;
    }

    function renderCard(c) {
        const { pet, card, actions, cd } = c;
        const owned = owns(pet.id);
        const isOn = equipped(pet.id);
        const away = farming.isAway(state, pet.id);
        card.dataset.state = away ? "away" : isOn ? "active" : owned ? "owned" : "locked";
        cd.textContent = owned && pet.cooldown ? cooldownText(pet) : "";
        let markup;
        if (away) {
            const trip = farming.tripStatus(state);
            cd.textContent = TEXT.petAway(trip.zone.name, trip.done ? "" : econ.formatClock(trip.left));
            markup = `<button data-action="detail" data-fx="G,w">${svgIcon("i-farm", 2)}${TEXT.petDetail}</button>`;
        } else if (!owned) {
            markup = `<button data-action="buy" data-fx="y,G,w" ${state.coins < pet.price ? "disabled" : ""}>${svgIcon("coin", 2)}${econ.formatNumber(pet.price)}</button>`;
        } else if (!isOn) {
            markup = `<button data-action="equip" data-fx="c,w" ${teamFull() ? 'data-full=""' : ""}>${TEXT.petEquip}</button>`;
        } else {
            const skill = pet.auto ? "" : `<button data-action="skill" class="pet-skill" data-fx="y,R,w" ${cooldownLeft(pet.id) > 0 ? "disabled" : ""}>${TEXT.petUse}</button>`;
            markup = `${skill}<button data-action="pat" data-fx="R,r,w">${svgIcon("heart", 2)}${TEXT.petPat}</button><button data-action="unequip" data-fx="l,w">${TEXT.petRemove}</button>`;
        }
        if (markup !== c.markup) actions.innerHTML = c.markup = markup;
    }

    // Top bar: the team's faces, then the first tap skill's countdown (or ON for an all-auto team).
    function render() {
        const list = members();
        let markup;
        if (!list.length) markup = `${svgIcon("i-paw", 2)}${TEXT.pets}`;
        else {
            const tapper = list.find((p) => !p.auto);
            const left = tapper ? cooldownLeft(tapper.id) : 0;
            markup = `${list.map((p) => svgIcon(p.id, 2)).join("")}<span>${left > 0 ? econ.formatClock(left) : tapper ? TEXT.petReady : TEXT.petOn}</span>`;
            el.button.dataset.ready = String(left <= 0);
        }
        if (!list.length) delete el.button.dataset.ready;
        if (markup !== el.button.innerHTML) el.button.innerHTML = markup;
        if (el.list.offsetParent) {
            renderTeam();
            cards.forEach(renderCard);
        }
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
        if (equipped("digit6")) {
            state.pets.sixCount = (state.pets.sixCount ?? 0) + 1;
            if (state.pets.sixCount % byId.digit6.every === 0) {
                roll = econ.loadDice(roll);
                shout(TEXT.sixShot, "c");
            }
        }
        return roll;
    }

    // SPINNY: an auto spin's stop lands in the green this often instead of freezing.
    const autoGood = () => equipped("spinny") && Math.random() < byId.spinny.autoGood;

    // MANEKI: a bet win sometimes pays double.
    function doubleWin(win) {
        if (!win || !equipped("maneki") || Math.random() >= byId.maneki.doubleChance) return false;
        shout(TEXT.goldenPaw, "y");
        return true;
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
        if (!equipped("cat") || awaySeconds < cat.napMinMinutes * 60) return 0;
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
        if (!equipped("banana")) return 0;
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
    on("bag-view", ({ view }) => {
        if (view !== "pets") return;
        renderTeam();
        cards.forEach(renderCard);
    });

    return {
        render,
        tick,
        open: reveal,
        ready,
        trigger,
        keepHeat,
        refundLoss,
        bendRoll,
        autoGood,
        doubleWin,
        replant,
        napInterest,
        pat,
        useSkill: () => useSkill(),
        catchWhileAway,
        has: equipped,
        leader: () => state.pets.team[0] ?? null,
    };
}
