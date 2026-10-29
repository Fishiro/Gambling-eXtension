# Pixel Slots AFK: game design

The design intent behind the numbers in `src/core/config.js`. Code says *what*; this says *why*, what was
rejected, and what is still open. Update it after a design decision, not after every tweak.
Verified by `npm test` (thresholds in section 9) and `npm run report` (curves and bot runs).

## 1. Core experience

A 5-minute break toy. Spin a timing-based slot, tap a mine, send DIGGS on trips; close the popup and the mine,
trips, garden and pets keep working. The player should feel *skill pays, time away pays, nothing is a dead end*.

## 2. Main loops

- **Slot (active):** bet -> stop the meter in the zone -> grade x heat x bonuses -> coins + XP -> bigger bet.
- **Mine (active + idle):** tap / drill -> cart -> sell into a market that punishes dumping -> upgrades.
- **Farm (idle):** trips and garden on timestamps -> materials -> forge gear and brews -> stats.
- **Meta:** chests from everything, pets, relics, vault, VIP. All feed a few shared stats (soft capped).

## 3. Mechanics in the order they are taught

| # | Mechanic | Level | Tour | Combines with |
| --- | --- | --- | --- | --- |
| 1 | Spin + timing meter + heat + burn | 1 | first tour | everything |
| 2 | Mine, overheat, ore market | 1 | `market` | slot (coins), vault |
| 3 | Bag + skins | 2 | `bag` | all drops |
| 4 | Pets (team, skills) | 3 | `pets` | slot, mine, farm |
| 5 | Farm: trips + garden (cave trips) | 4 | `farm` | pets ride along |
| 6 | Forge: gear + brews | 5 | `forge` | farm materials, junk |
| 7 | Volcano trips | 6 | (zone list) | forge (ember, obsidian) |
| 8 | VIP + Vault | 7 | `vault` | slot bets, mine taps |
| 9 | Relics, space trips | 10 | `relics` | vault, legendary chests |

Every level from 2 to 11 also opens a bigger bet step, so each level up gives something (tested).

## 4. Difficulty curve

**Type: sawtooth on a front-loaded trend** (`economy.difficulty`, `TIMING.curve`).
The trend rises to 1 at LV26 with exponent 0.85 (learning is fastest early). Levels come in chapters of 5:
difficulty climbs through a chapter, the next chapter opens lower than the last peak (a breather, usually when
a new feature arrives), and every peak is higher than the one before. Difficulty sets the meter's zone width
(0.34 -> 0.10) and sweep speed (0.8 -> 2.2).

**DDA on top**, kept small on purpose (Hamlet's warning): recent skill shifts width by about -14%..+21% and speed
by the inverse half, clamped. Bot runs keep every level above a 10% hit rate for a casual player.

**XP:** x1.8 per level while levels still open bigger bets (to LV12), then x1.25. LV30 is ~170 max bets.

## 5. Chapter cards

| Chapter | Levels | Teaches | Step | Win condition | Why harder than before |
| --- | --- | --- | --- | --- | --- |
| 1 | 1-5 | slot, mine, market, bag, pets, farm, forge | introduce | reach LV5 | first meter speed-up |
| 2 | 6-10 | combine: pets on trips, forge from trips, vault | develop | first relic | zone below 0.25 |
| 3 | 11-15 | VIP bets, relic builds, combo brews | twist | crack vault 1-3 | speed past 1.6 |
| 4 | 16-20 | star gear, sets | develop | first 3-star set | zone below 0.15 |
| 5 | 21-26 | full team, max VIP climb | conclude | peak difficulty | meter at its hardest |

## 6. Depth and trade-offs

- Pets on a trip leave the team (finds vs. bonus now).
- Trip stance: FORAGE (x1.4 finds, x0.6 luck) vs DELVE (x0.6 finds, x1.8 luck) vs STEADY.
- Junk: scrap for coins now, or keep it for combo brews.
- Market: sell a cart a minute at a fair price, or dump and crash it.
- Big bets: more XP and burn, more risk; OINKER and BONSAI soften losses.

## 7. Economy rules

- **Base slot return x0.85** (no skill). Skill pays: perfect + max heat + burn is ~x1.8.
- **Soft caps** (`STAT_CAPS`): past a knee each stat gives diminishing returns toward a hard cap. The payout stat
  (burn included) caps at +50%, so the strongest build returns ~x2.1 with flawless play and ~x1.26 with none
  (was ~x8 uncapped).
- **Mine upgrades compound** (`value = (base + step*lv) * compound^lv`), so payback grows ~x1.3 per level instead of
  exploding. Bots earn ~45-55% of their coins from the mine.
- **Chests follow the usual bet** (`luck.rewardUnit`), with pity: an epic+ at least every 15, a legendary every 60.

## 8. Rejected alternatives (do not re-propose)

- **Hard cap per stat:** dead upgrades at the cap feel bad; soft cap keeps every purchase worth a little.
- **Nerfing the timing grades:** the meter is the game's identity; skill must stay the best multiplier.
- **Linear mine upgrades with cheaper costs:** still a wall, just later. Compounding fixes the shape.
- **Easy/Normal/Hard picker:** players choose before knowing the game; the sawtooth + small DDA do it in-structure.
- **Big DDA swings:** Hamlet: frequent visible intervention breaks immersion and becomes exploitable.
- **Selling junk at the market:** it would mix with ore supply/glut; scrap is a separate, flat price.

## 9. Acceptance criteria (enforced by `tests/`)

- Base slot return in x0.78..x0.95; skilled > x1.2; max build < x1.35 with no skill, < x2.3 flawless.
- Difficulty: rising peaks, each chapter opens easier than the last peak, 0 at LV1, 1 at the end.
- XP: ratio per level never above xpGrowth; LV30 under 300 max bets.
- Something unlocks at every level 2-11.
- Mine: value always rises; payback never jumps more than x1.6 per level.
- Chests: shares within tolerance of the table; no dry streak reaches the pity limit.
- Bots (casual, skilled): LV10 within 30 min of play, no level taking 3x the recent ones, mine share 20-80%,
  hit rate above 10% at every level.
- Saves: versioned, old saves migrate, broken or hostile imports are rejected or clamped.
- Every relative import resolves; `src/core` never touches the DOM.

## 10. Open questions

- 21 pets is a lot to read at LV3. Gate the legend tier in the shop until LV10?
- Should the vault give relics before the relic view opens at LV10, or hold them?
- Late game (LV30+) relies on VIP bet steps; is the x1.25 XP tail right once VIP is maxed?
- The bot models timing as a fixed aim error; real players improve. Calibrate with real hit-rate data.
- Art and sound are hand-made pixel sprites and synth sfx; no AI-generated assets.
