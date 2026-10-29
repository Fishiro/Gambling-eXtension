import { PETS, ITEMS, SKINS, VIP } from "./config.js";
import { formatNumber, formatClock } from "./economy.js";
import { vipTier } from "./vip.js";

// Every record the game keeps, grouped for the STATS page. Counters live in state.stats and state.fun
// (written by slot/chest/history and the achievement listeners); this only reads them.

const n = (x) => formatNumber(x ?? 0);
const pct = (part, all) => (all ? `${Math.round((part / all) * 100)}%` : "-");
const hours = (seconds) => (seconds >= 86400 ? `${(seconds / 86400).toFixed(1)}D` : formatClock(seconds ?? 0));

export function recordGroups(state) {
    const s = state.stats;
    const f = state.fun;
    const owned = (list, have) => `${have}/${list.length}`;
    return [
        {
            title: "SLOT",
            rows: [
                ["SPINS", n(s.spins)],
                ["HIT RATE", pct(s.timed, s.spins)],
                ["PERFECTS", n(s.perfects)],
                ["BEST PERFECT RUN", n(f.bestPerfRun)],
                ["BEST WIN", n(s.bestWin)],
                ["BEST MULTIPLIER", s.bestMult ? `x${n(s.bestMult)}` : "-"],
                ["BIGGEST BET", n(f.bigBet)],
                ["TOTAL BET", n(state.burned)],
                ["TOTAL WON", n(f.coinsWon)],
                ["BEST WIN STREAK", n(f.bestWinRun)],
                ["WORST LOSS STREAK", n(f.worstStreak)],
                ["NEAR MISSES", n(f.near)],
                ["JACKPOTS 7-7-7", n(f.jackpots)],
                ["COSMIC ROLLS", n(s.cosmic)],
            ],
        },
        {
            title: "MINE",
            rows: [
                ["TAPS", n(f.taps)],
                ["BEST COMBO", f.bestCombo ? `x${n(f.bestCombo)}` : "-"],
                ["ORE SOLD", n(f.oreSold)],
                ["COINS FROM ORE", n(f.sellCoins)],
                ["BIGGEST SALE", `${n(f.bestSell)} ORE`],
                ["BEST SALE PAY", n(f.bestSellCoins)],
                ["GOLDEN BATS", n(f.bats)],
                ["PET SKILLS USED", n(f.skills)],
            ],
        },
        {
            title: "LOOT",
            rows: [
                ["CHESTS OPENED", n(s.chestsOpened)],
                ["LEGENDARY CHESTS", n(f.legendaryChests)],
                ["SEEDS PLANTED", n(f.plants)],
                ["HARVESTS", n(f.harvests)],
                ["GOLD FRUIT", n(f.goldfruits)],
                ["GEAR CRAFTED", n(f.crafts)],
                ["FAILED ASCENDS", n(f.ascendFails)],
                ["STARS LOST", n(f.starsLost)],
                ["BREWS DRUNK", n(f.brews)],
                ["JUNK SCRAPPED", `${n(f.scrapCoins)} COIN`],
                ["BEST VAULT", n(f.bestVault ?? state.vault.tier)],
                ["CAT NAP COINS", n(f.napCoins)],
            ],
        },
        {
            title: "YOU",
            rows: [
                ["LEVEL", n(state.level)],
                ["VIP", VIP[vipTier(state)].name],
                ["DIAMONDS", n(state.gems)],
                ["PETS", owned(PETS, state.pets.owned.length)],
                ["ITEMS FOUND", owned(Object.keys(ITEMS), Object.keys(state.bag).length)],
                ["SKINS", owned(SKINS, state.skins.owned.length)],
                ["ACHIEVEMENTS", n(Object.keys(state.achv).length)],
                ["TIMES OPENED", n(f.opens)],
                ["DAYS PLAYED", n(f.days)],
                ["LONGEST AWAY", hours(f.longestAway)],
            ],
        },
    ];
}
