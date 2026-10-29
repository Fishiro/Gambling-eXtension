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

**XP is logarithmic in the stake** (`economy.xpForStake`): `10 * ln(1 + stake / 10)`. Every x10 on the bet adds
the same ~23 XP, so a 10K bet gives ~72 XP a spin and a 5M VIP bet only ~138: big bets help a little, they never
inflate levels. **Mining XP is a trickle:** everything sold in one market minute counts as one sale worth
`sellXp` (0.5) spins staking those coins (`market.sellXpFor`). XP is logarithmic, so per-sale XP let twenty small
sales earn ~7x one big one and spam-selling in a hot market farmed levels; pooled per minute, splitting earns
nothing, and a whole minute of selling at the top price is under two spins (~36 XP at LV12, a level is 1,656).
**XP per level is set in spins:** level L costs `8 * 1.1^(L-1)` GOOD spins at its top non-VIP bet (LV10 ~19,
LV20 ~49, LV30 ~127), so the pace is what the player feels, not a number that drifts with the bet table.

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

- **Easy wins are rare-ish (2026-10-29, owner's call):** CHERRY, LEMON and BELL lines only land half the time
  (`EASY_KEEP`, the rest slip into a near miss); any line hits ~12% of spins. Payouts were not raised, so the
  slot is a **coin sink unless you time well**: base return x0.59, good timing + heat 3 ~x0.75, flawless ~x1.26.
  The mine and chests carry the wallet; the slot is for XP, burn, chests, the vault and big swings.
- **Bets:** type any whole amount up to the level cap: 5 at LV1, doubling each level (2 significant digits), 1M
  from LV19. 1M is absolute: VIP gives payout/chest bonuses, never bigger bets.
- **Pets raise odds, never force results:** SEVEN's skill gives 7 spins at exactly 2.5% 7-7-7 (natural odds
  included); DICEY and SIX give a 30% chance to bend a dead roll into a pair, which can never be a triple.
- **Soft caps** (`STAT_CAPS`): past a knee each stat gives diminishing returns toward a hard cap. The payout stat
  (burn included) caps at +50%, so the strongest build returns ~x2.1 with flawless play and ~x1.26 with none
  (was ~x8 uncapped).
- **Mine upgrades compound** (`value = (base + step*lv) * compound^lv`), so payback grows ~x1.3 per level instead of
  exploding. Bots earn ~45-55% of their coins from the mine.
- **Chests never depend on the bet (high risk, high reward).** A bet spin of any size drops exactly one chest
  10% of the time (`economy.spinChest`, nothing raises it; a GEM/SEVEN triple or double star makes it blessed).
  Burn past SUPERNOVA no longer pays chests (one 1M bet used to fill the stash with 25). Chest coins (and scrap)
  are `25 x level` units (`luck.rewardUnit`), so chests can't pay a big bet back: with bet-scaled coins they
  added ~+0.30x bet a spin. Pity: an epic+ at least every 15, a legendary every 60. Mine taps, bats and time away
  drop half as often as in 1.1; common/rare weights halved (common ~54%, rare 25%, epic 18%, legendary 3.6%).
- **Stars can crack:** star 1..5 succeed 80/65/45/30/15% (`STAR_CHANCE`). A failure spends the cost and cracks
  one star off (never below LV5). Expected tries grow fast past 3 stars: the top of gear is a gamble, on purpose.
- **Every craft costs coins** (`CRAFT_FEE`): gear LV1-5 pays 200 x 1.7^level on top of materials, brews pay by
  rarity (rare 400, epic 2,000, legendary 10,000), stars keep their own STAR_COST coins.
- **Play drops:** common and rare finds drop half as often; epic and legendary finds keep their odds.

## 7b. Sound

Every event has its own synthesized voice on one of five buses (BUTTONS, SLOT, MINE, LOOT, FARM/PETS/FORGE),
each with a mixer slider. Hype rules: streaks climb in pitch (heat pips up a pentatonic scale, combo taps, bet
steps by how close to the cap, bigger sales jingle more coins), rarity scales length and fullness (chest reveal
coin -> chime -> fanfare -> choir), and suspense gets a riser (two matching reels, a star attempt). Losses are
short and soft so they never punish louder than wins reward. Spammable sounds are throttled.

## 8. Rejected alternatives (do not re-propose)

- **Hard cap per stat:** dead upgrades at the cap feel bad; soft cap keeps every purchase worth a little.
- **Linear XP (XP = bet) with a steeper level curve:** a few huge bets still skip levels and the curve has to
  chase the bet table; log XP fixes the cause.
- **Nerfing the timing grades:** the meter is the game's identity; skill must stay the best multiplier.
- **Linear mine upgrades with cheaper costs:** still a wall, just later. Compounding fixes the shape.
- **Easy/Normal/Hard picker:** players choose before knowing the game; the sawtooth + small DDA do it in-structure.
- **Big DDA swings:** Hamlet: frequent visible intervention breaks immersion and becomes exploitable.
- **Selling junk at the market:** it would mix with ore supply/glut; scrap is a separate, flat price.

## 9. Acceptance criteria (enforced by `tests/`)

- Base slot return in x0.5..x0.7; flawless > x1.15; max build < x1 with no skill, < x1.7 flawless.
- Easy lines land at EASY_KEEP of their weight odds (Monte Carlo within 8%); SEVEN never passes 2.5% 7-7-7 and a
  bend never makes a jackpot.
- Bet cap never above 1M, VIP included; typed bets parse ("2.5K", "1M") and clamp.
- A bet spin drops a chest 10% of the time at bet 1 and at 1M alike, never at bet 0; chest coins ignore the bet.
- Star odds only fall, 80% to 15%, and each lands within 1.5% over 20,000 tries; LV1-5 never fail; a failed
  star drops one star, a failed first star stays at LV5.
- Every gear level and every brew costs coins; materials alone can't pay.
- Difficulty: rising peaks, each chapter opens easier than the last peak, 0 at LV1, 1 at the end.
- XP: logarithmic (x10 bet = same flat gain); one perfect spin at the top VIP bet is under 1/4 of a level; LV30 under 200 spins.
- Mining XP: any number of sales in one market minute earns exactly what one sale of their total would; a minute
  of selling a big cart at the top price is worth under two spins of XP at every level.
- Something unlocks at every level 2-11.
- Mine: value always rises; payback never jumps more than x1.6 per level.
- Chests: shares within tolerance of the table; no dry streak reaches the pity limit.
- Bots (casual, skilled): LV10 within 30 min of play, no level taking 3x the recent ones, net income positive with
  the mine earning,
  hit rate above 10% at every level.
- Saves: versioned, old saves migrate, broken or hostile imports are rejected or clamped.
- Every relative import resolves; `src/core` never touches the DOM.

## 10. Open questions

- The slot now loses coins for most players (x0.59-x0.75). Raise the easy payouts x2 to restore ~x0.85 with
  fewer, bigger wins, or keep the slot as a sink?
- 21 pets is a lot to read at LV3. Gate the legend tier in the shop until LV10?
- Should the vault give relics before the relic view opens at LV10, or hold them?
- Late game (LV30+) relies on VIP bet steps; is the x1.25 XP tail right once VIP is maxed?
- The bot models timing as a fixed aim error; real players improve. Calibrate with real hit-rate data.
- Art and sound are hand-made pixel sprites and synth sfx; no AI-generated assets.
