import { VAULT, VIP, BET_STEPS, BREW_FX } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import * as luck from "./luck.js";
import * as items from "./items.js";
import { vipInfo } from "./vip.js";
import { svgIcon, PALETTE } from "./sprites.js";
import * as fx from "./fx.js";
import * as modal from "./modal.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { $, lootLines } from "./ui.js";
import { emit } from "./events.js";
import { isOpen } from "./unlocks.js";

const today = () => new Date().toDateString();
const maxHp = (tier) => Math.round(VAULT.baseHp * VAULT.growth ** tier);

// What cracking vault `tier` pays: scales with the vault, relic rarity floor rises with it.
function treasure(tier) {
    return {
        coins: maxHp(tier) * 2,
        gems: 3 + tier,
        relicFloor: tier >= 8 ? 2 : tier >= 3 ? 1 : 0,
        loot: { relicDust: 2 + tier, stardust: 3 + tier, meteor: 1 + Math.floor(tier / 2), goldfruit: Math.floor(tier / 3) },
    };
}

// The Vault (one a day) and the VIP card, both on the slot's side panel.
export function createVault() {
    const el = {
        card: $("vault"),
        tier: $("vault-tier"),
        fill: $("vault-fill"),
        hp: $("vault-hp"),
        vip: $("vip"),
        vipName: $("vip-name"),
        vipFill: $("vip-fill"),
        vipNext: $("vip-next"),
        vipPerks: $("vip-perks"),
    };
    let shownVip = vipInfo(state).index;

    // A new day brings a fresh vault at the current tier.
    function refresh() {
        const v = state.vault;
        if (v.day === today()) return;
        Object.assign(v, { day: today(), hp: maxHp(v.tier), cracked: false });
        commit();
    }

    function damage(amount, from) {
        if (!isOpen(state, "endgame")) return;
        refresh();
        const v = state.vault;
        if (v.cracked || amount <= 0) return;
        v.hp = Math.max(0, v.hp - Math.round(amount));
        if (from) {
            const p = fx.centerOf(from);
            fx.float(p.x, p.y, `-${econ.formatNumber(amount)}`, { color: "R", rise: 0.5, life: 40 });
        }
        if (v.hp === 0) crack();
    }

    function crack() {
        const v = state.vault;
        const prize = treasure(v.tier);
        v.cracked = true;
        v.tier += 1;
        state.coins += prize.coins;
        state.gems += prize.gems;
        const loot = Object.fromEntries(Object.entries(prize.loot).filter(([, n]) => n > 0));
        items.addAll(state, loot);
        const relicLines = luck.applyReward(state, { type: "relic", floor: prize.relicFloor }).lines;
        commit();
        sfx.jackpot();
        fx.shake(el.card, 6, 500);
        modal.show({
            icon: "vault",
            title: TEXT.vaultCracked(v.tier),
            sub: TEXT.vaultSub,
            lines: [
                `${svgIcon("coin", 2)}+${econ.formatNumber(prize.coins)} COIN`,
                `${svgIcon("gem", 2)}${TEXT.gemsGained(prize.gems)}`,
                ...relicLines.map((l) => `${svgIcon(l.icon, 2)}${l.text}`),
                ...lootLines(loot).map((l) => `${svgIcon(l.icon, 2)}${l.text}`),
            ],
            columns: 2,
            ok: TEXT.vaultOk,
            color: "y",
            confetti: 3,
        });
        emit("vault-crack", { tier: v.tier });
    }

    // Spin damage: bet x grade, plus whatever the spin won. A Vault Breaker brew triples it.
    function spinHit({ bet, grade, win }) {
        if (!bet) return;
        let mult = 1;
        if (state.buffs.breakerSpins > 0) {
            state.buffs.breakerSpins--;
            mult = BREW_FX.breakerMult;
        }
        damage((bet * VAULT.spinGrade[grade] + win) * mult, el.card.offsetParent ? el.fill : null);
    }

    function checkVip() {
        const info = vipInfo(state);
        if (info.index <= shownVip) return;
        shownVip = info.index;
        modal.show({
            icon: "gem",
            title: TEXT.vipUp(info.tier.name),
            sub: TEXT.vipSub,
            lines: vipPerks(info.index).map((p) => `${svgIcon("next", 2)}${p}`),
            ok: TEXT.vipOk,
            color: info.tier.color,
            confetti: 2,
            sound: sfx.levelUp,
        });
        emit("vip-up", { tier: info.index });
    }

    function vipPerks(index) {
        const tier = VIP[index];
        const perks = Object.entries(tier.bonus).map(([stat, per]) => `+${Math.round(per * 100)}% ${TEXT.statName[stat]}`);
        if (index) perks.push(TEXT.vipBet(econ.formatNumber(BET_STEPS[Math.min(BET_STEPS.length - 1, 13 + index)])));
        return perks;
    }

    function render() {
        if (!isOpen(state, "endgame")) return;
        refresh();
        const v = state.vault;
        const full = maxHp(v.cracked ? v.tier - 1 : v.tier);
        el.tier.textContent = TEXT.vaultTier(v.cracked ? v.tier : v.tier + 1);
        el.fill.style.width = `${v.cracked ? 0 : (v.hp / full) * 100}%`;
        el.hp.textContent = v.cracked ? TEXT.vaultDone : `${econ.formatNumber(v.hp)} / ${econ.formatNumber(full)}`;
        el.card.title = v.cracked ? TEXT.vaultTomorrow : TEXT.vaultHint;
        el.card.dataset.cracked = String(v.cracked);

        const info = vipInfo(state);
        el.vip.style.setProperty("--tone", PALETTE[info.tier.color]);
        el.vipName.textContent = `VIP ${info.tier.name}`;
        el.vipFill.style.width = `${Math.min(1, info.progress) * 100}%`;
        el.vipNext.textContent = info.next ? TEXT.vipNext(econ.formatNumber(info.next.at - state.burned), info.next.name) : TEXT.vipTop;
        // Short headline on the card; the full perk list sits in the tooltip.
        const perks = info.index ? vipPerks(info.index) : [];
        el.vipPerks.textContent = perks[0] ?? "";
        el.vip.title = perks.length ? perks.join(" / ") : TEXT.vipGuest;
        checkVip();
    }

    refresh();
    return { render, damage, spinHit };
}
