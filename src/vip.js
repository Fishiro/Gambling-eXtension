import { VIP } from "./config.js";

// VIP is pure history: the tier comes from every coin you have ever bet (state.burned), so it never drops.

export function vipTier(state) {
    let i = 0;
    while (i < VIP.length - 1 && state.burned >= VIP[i + 1].at) i++;
    return i;
}

export function vipInfo(state) {
    const index = vipTier(state);
    const tier = VIP[index];
    const next = VIP[index + 1] ?? null;
    return { index, tier, next, progress: next ? (state.burned - tier.at) / (next.at - tier.at) : 1 };
}

export const vipBonus = (state, stat) => VIP[vipTier(state)].bonus[stat] ?? 0;
