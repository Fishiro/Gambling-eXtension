import { PETS, GEAR, FARM, GEAR_MAX, TIMING, LUCK, SKINS, VIP, GEAR_SETS, RELICS, BREWS, ITEMS } from "./config.js";
import { state, commit } from "./store.js";
import * as econ from "./economy.js";
import { PALETTE, svgIcon } from "./sprites.js";
import * as fx from "./fx.js";
import { toast } from "./toast.js";
import { sfx } from "./sound.js";
import { TEXT } from "./text.js";
import { on } from "./events.js";
import { $ } from "./ui.js";

const HOUR = 3600;
const TOAST_MAX = 4;
const DAY = 24 * HOUR;
const JUNK = Object.keys(ITEMS).filter((id) => ITEMS[id].junk);

// Purely for fun: no achievement gives anything. Tests read state, state.fun counters and the clock.
const LIST = [
    ["hello", "HELLO WORLD", "OPEN THE GAME. THAT'S IT.", (s, f) => f.opens >= 1],
    ["regular", "REGULAR", "OPEN THE GAME 25 TIMES", (s, f) => f.opens >= 25],
    ["grass", "TOUCH GRASS", "OPEN THE GAME 100 TIMES. PLEASE GO OUTSIDE", (s, f) => f.opens >= 100],
    ["owl", "NIGHT OWL", "PLAY BETWEEN 2AM AND 5AM. GO TO SLEEP.", (s, f, d) => d.getHours() >= 2 && d.getHours() < 5, true],
    ["lunch", "LUNCH BREAK", "PLAY BETWEEN 12 AND 1 PM. EAT SOMETHING", (s, f, d) => d.getHours() === 12],
    ["friday", "TGIF", "PLAY ON A FRIDAY", (s, f, d) => d.getDay() === 5],
    ["monday", "CASE OF THE MONDAYS", "PLAY ON A MONDAY. WE KNOW.", (s, f, d) => d.getDay() === 1],
    ["newyear", "NEW YEAR, SAME ME", "PLAY ON JANUARY 1ST", (s, f, d) => d.getMonth() === 0 && d.getDate() === 1, true],
    ["away8", "WELCOME BACK", "STAY AWAY FOR 8 HOURS", (s, f) => f.longestAway >= 8 * HOUR],
    ["away3d", "WE THOUGHT YOU DIED", "STAY AWAY FOR 3 DAYS", (s, f) => f.longestAway >= 3 * DAY],
    ["marathon", "THE BOSS IS BEHIND YOU", "KEEP THE POPUP OPEN FOR 10 MIN STRAIGHT", (s, f, d, x) => x.session >= 600],
    ["spin1", "BABY'S FIRST SPIN", "SPIN ONCE", (s) => s.stats.spins >= 1],
    ["spin500", "SPIN DOCTOR", "SPIN 500 TIMES", (s) => s.stats.spins >= 500],
    ["spin5k", "DIZZY", "SPIN 5,000 TIMES", (s) => s.stats.spins >= 5000],
    ["tap1k", "CARPAL TUNNEL", "TAP THE ROCK 1,000 TIMES", (s, f) => f.taps >= 1000],
    ["tap10k", "WOODPECKER", "TAP THE ROCK 10,000 TIMES", (s, f) => f.taps >= 10000],
    ["full", "IT'S FULL", "TAP A FULL CART 20 TIMES. IT WAS FULL.", (s, f) => f.tapFull >= 20],
    ["sellOne", "THE ECONOMY THANKS YOU", "SELL EXACTLY 1 ORE", (s, f) => f.sellOne >= 1],
    ["sell1k", "BULK DISCOUNT", "SELL 1,000 ORE AT ONCE", (s, f) => f.bestSell >= 1000],
    ["ore10k", "GOLD DIGGER", "SELL 10,000 ORE IN TOTAL", (s, f) => f.oreSold >= 10000],
    ["dj", "DJ PIXEL", "TOGGLE SOUND 10 TIMES. SICK BEATS", (s, f) => f.sound >= 10],
    ["mute", "THE NEIGHBORS THANK YOU", "MUTE THE GAME", (s) => !s.sound],
    ["esc", "ESCAPE ARTIST", "PRESS ESC 30 TIMES", (s, f) => f.esc >= 30],
    ["manual", "NOBODY READS THE MANUAL", "OPEN THE MENU 10 TIMES", (s, f) => f.menu >= 10],
    ["history", "HISTORIAN", "OPEN HISTORY 10 TIMES. THE PAST WON'T CHANGE", (s, f) => f.history >= 10],
    ["reset", "COMMITMENT ISSUES", "ALMOST RESET, THEN CHICKEN OUT. 3 TIMES.", (s, f) => f.resetNo >= 3],
    ["broke", "FINANCIAL ADVISOR LEFT THE CHAT", "HIT 0 COINS", (s, f) => s.coins <= 0 && f.opens >= 1],
    ["seven", "LUCKY NUMBER", "HAVE EXACTLY 777 COINS", (s) => s.coins === 777, true],
    ["balanced", "PERFECTLY BALANCED", "HAVE AS MANY COINS AS ORE", (s) => s.coins > 0 && s.coins === Math.floor(econ.oreAt(s)), true],
    ["million", "MILLIONAIRE (ON PAPER)", "HAVE 1,000,000 COINS", (s) => s.coins >= 1e6],
    ["near", "SO CLOSE. AGAIN.", "GET 10 NEAR MISSES", (s, f) => f.near >= 10],
    ["lose10", "COPIUM OVERDOSE", "LOSE 10 SPINS IN A ROW", (s, f) => f.worstStreak >= 10],
    ["lose25", "THE MACHINE IS DEFINITELY HOT", "LOSE 25 SPINS IN A ROW", (s, f) => f.worstStreak >= 25],
    ["slow", "TOO SLOW", "LET THE METER STOP BY ITSELF 10 TIMES", (s, f) => f.slow >= 10],
    ["perfect", "PERFECTIONIST", "GET 50 PERFECTS", (s) => s.stats.perfects >= 50],
    ["practice", "ALL FUN, NO RISK", "SPIN 25 TIMES AT BET 0", (s, f) => f.practice >= 25],
    ["highroller", "HIGH ROLLER", "BET 1,000 OR MORE ON ONE SPIN", (s, f) => f.bigBet >= 1000],
    ["jackpot", "777", "HIT THE JACKPOT", (s, f) => f.jackpot >= 1],
    ["cosmic", "SPACE CADET", "HIT A COSMIC ROLL", (s) => s.stats.cosmic >= 1],
    ["wiggle", "UP DOWN UP DOWN", "CHANGE YOUR BET 100 TIMES", (s, f) => f.betChanges >= 100],
    ["stuck", "THERE IS NO HIGHER", "PRESS + AT MAX BET 10 TIMES", (s, f) => f.betStuck >= 10],
    ["combo500", "PLASMA HANDS", "REACH A x500 COMBO", (s, f) => f.bestCombo >= 500],
    ["combo2k", "COSMIC FINGERS", "REACH A x2,000 COMBO", (s, f) => f.bestCombo >= 2000],
    ["bat", "BATMAN", "CATCH 10 GOLDEN BATS", (s, f) => f.bats >= 10],
    ["chest", "CHESTY", "OPEN 50 CHESTS", (s) => s.stats.chestsOpened >= 50],
    ["lv5", "GETTING SOMEWHERE", "REACH LV5", (s) => s.level >= 5],
    ["lv15", "NO LIFE", "REACH LV15", (s) => s.level >= 15],
    ["pet1", "PET OWNER", "BUY A PET", (s) => s.pets.owned.length >= 1],
    ["petAll", "GOTTA BUY 'EM ALL", `OWN ALL ${PETS.length} PETS`, (s) => s.pets.owned.length >= PETS.length],
    ["rock", "YOU PAID FOR A ROCK", "BUY DWAYNE. HE IS A ROCK.", (s) => s.pets.owned.includes("rock")],
    ["office", "PROMOTED TO TYPIST", "BUY THE 9 TO 5 SKIN. THE BOSS THANKS YOU.", (s) => s.skins.owned.includes("office")],
    ["meta", "THE HOUSE ALWAYS WINS", "BUY PLAY ITSELF. YES, THAT'S YOU.", (s) => s.skins.owned.includes("casino")],
    ["fluff", "NOT FAT, FLUFFY", "ADOPT MEEMEE. MEEMEE WILL NOT MOVE.", (s) => s.pets.owned.includes("cat")],
    ["napper", "PASSIVE INCOME", "EARN 10K COINS FROM CAT NAPS", (s, f) => f.napCoins >= 10_000],
    ["clock", "TIME IS A FLAT HOURGLASS", "BUY SANDY", (s) => s.pets.owned.includes("hourglass")],
    ["fruit", "FRUIT SALAD", "OWN SIR BANANA AND BERRY", (s) => ["banana", "berry"].every((id) => s.pets.owned.includes(id))],
    ["pat50", "GOOD BOY", "PET YOUR PET 50 TIMES", (s, f) => f.pats >= 50],
    ["pat500", "IT CAN'T FEEL THAT", "PET YOUR PET 500 TIMES", (s, f) => f.pats >= 500],
    ["swap", "INDECISIVE", "SWAP PETS 20 TIMES", (s, f) => f.swaps >= 20],
    ["toast", "TOAST MASTER", "USE TOAST RUSH 10 TIMES", (s, f) => f.skill_toaster >= 10],
    ["craft", "BLACKSMITH-ISH", "CRAFT YOUR FIRST GEAR", (s, f) => f.crafts >= 1],
    ["overkill", "OVERKILL", `MAX OUT ANY GEAR TO LV${GEAR_MAX}`, (s) => Object.values(s.gear).some((lv) => lv >= GEAR_MAX)],
    ["loaded", "FULLY LOADED", "OWN EVERY PIECE OF GEAR", (s) => GEAR.every((g) => s.gear[g.id] >= 1)],
    ["potion", "MY POTIONS ARE TOO STRONG", "DRINK 10 BREWS", (s, f) => f.brews >= 10],
    ["thumb", "GREEN THUMB", "HARVEST 10 TIMES", (s, f) => f.harvests >= 10],
    ["farmville", "FARMVILLE VETERAN", "HARVEST 100 TIMES", (s, f) => f.harvests >= 100],
    ["wander", "WANDERLUST", "FINISH AN EXPEDITION", (s, f) => f.trips >= 1],
    ["tourist", "TOURIST", "FINISH A TRIP IN EVERY ZONE", (s, f) => FARM.zones.every((z) => f[`trip_${z.id}`])],
    ["abandon", "ABANDONMENT ISSUES", "SEND DIGGS ON THE LONGEST TRIP (4 HOURS)", (s, f) => f.trip8h >= 1],
    ["helicopter", "HELICOPTER PARENT", "CALL DIGGS BACK EARLY 5 TIMES", (s, f) => f.recalls >= 5],
    ["nap", "DIGGS NAPPED", "COME BACK FROM A TRIP WITH NOTHING", (s, f) => f.naps >= 1, true],
    ["hoarder", "HOARDER", "HOLD 500 ITEMS AT ONCE", (s) => Object.values(s.bag).reduce((a, n) => a + n, 0) >= 500],
    ["spacerock", "SPACE ROCK", "FIND A METEORITE", (s) => "meteor" in s.bag],
    ["clicks", "YOUR MOUSE FILED A COMPLAINT", "CLICK 2,000 BUTTONS", (s, f) => f.clicks >= 2000],
    ["keys", "KEYBOARD WARRIOR", "USE 500 HOTKEYS", (s, f) => f.keys >= 500],
    ["impatient", "IMPATIENT", "TAP A LOCKED ACHIEVEMENT 10 TIMES. IT WON'T HELP.", (s, f) => f.impatient >= 10],
    ["nothing", "THIS DOES NOTHING", "OPEN THE ACHIEVEMENT LIST", (s, f) => f.sawList >= 1],
    // ---- round two: more nonsense ----
    ["midnight", "WITCHING HOUR", "PLAY BETWEEN MIDNIGHT AND 1 AM", (s, f, d) => d.getHours() === 0, true],
    ["weekend", "WEEKEND WARRIOR", "PLAY ON A SATURDAY OR SUNDAY", (s, f, d) => d.getDay() === 0 || d.getDay() === 6],
    ["earlybird", "EARLY BIRD", "PLAY BETWEEN 5 AND 7 AM. THE WORM CAN WAIT", (s, f, d) => d.getHours() >= 5 && d.getHours() < 7],
    ["halloween", "SPOOKY SPINS", "PLAY ON HALLOWEEN", (s, f, d) => d.getMonth() === 9 && d.getDate() === 31, true],
    ["xmas", "SANTA'S LITTLE GAMBLER", "PLAY ON CHRISTMAS DAY", (s, f, d) => d.getMonth() === 11 && d.getDate() === 25, true],
    ["pi", "3.14159", "PLAY ON PI DAY (MARCH 14)", (s, f, d) => d.getMonth() === 2 && d.getDate() === 14, true],
    ["marathon30", "ONE MORE SPIN", "KEEP THE POPUP OPEN FOR 30 MIN STRAIGHT", (s, f, d, x) => x.session >= 1800],
    ["away7d", "THE PRODIGAL MINER", "STAY AWAY FOR A WHOLE WEEK", (s, f) => f.longestAway >= 7 * DAY],
    ["opens500", "IS THIS A JOB NOW?", "OPEN THE GAME 500 TIMES", (s, f) => f.opens >= 500],
    ["spin25k", "THE REELS KNOW YOUR NAME", "SPIN 25,000 TIMES", (s) => s.stats.spins >= 25000],
    ["perfect500", "SNIPER", "GET 500 PERFECTS", (s) => s.stats.perfects >= 500],
    ["perfRun5", "IN THE ZONE", "5 PERFECTS IN A ROW", (s, f) => f.bestPerfRun >= 5],
    ["perfRun15", "ARE YOU A ROBOT?", "15 PERFECTS IN A ROW. BEEP BOOP.", (s, f) => f.bestPerfRun >= 15],
    ["timed1k", "METRONOME", "LAND 1,000 TIMED STOPS", (s) => s.stats.timed >= 1000],
    ["winRun5", "HOT HANDS", "WIN 5 SPINS IN A ROW", (s, f) => f.bestWinRun >= 5],
    ["winRun10", "THE CASINO IS NERVOUS", "WIN 10 SPINS IN A ROW", (s, f) => f.bestWinRun >= 10],
    ["lose50", "IT'S RIGGED (IT'S NOT)", "LOSE 50 SPINS IN A ROW", (s, f) => f.worstStreak >= 50, true],
    ["near100", "SO CLOSE, FOREVER", "GET 100 NEAR MISSES", (s, f) => f.near >= 100],
    ["jackpot5", "777 777 777 777 777", "HIT THE JACKPOT 5 TIMES", (s, f) => f.jackpots >= 5],
    ["cosmic5", "ASTRONAUT", "HIT 5 COSMIC ROLLS", (s) => s.stats.cosmic >= 5],
    ["bigwin", "RICH FOR A SECOND", "WIN 100,000 COINS ON ONE SPIN", (s) => s.stats.bestWin >= 100_000],
    ["maxbet", "ALL IN (KINDA)", "BET 10,000 ON ONE SPIN", (s, f) => f.bigBet >= 10_000],
    ["heatmax", "ON FIRE", "FILL THE HEAT BAR", (s) => s.heat >= TIMING.heatMax],
    ["burn1m", "MONEY FURNACE", "BURN 1,000,000 COINS ON BETS", (s) => s.burned >= 1e6],
    ["practice500", "PRACTICE MAKES... NOTHING", "SPIN 500 TIMES AT BET 0", (s, f) => f.practice >= 500],
    ["autopilot", "LOOK MA, NO HANDS", "TURN ON AUTO SPIN", (s) => s.auto],
    ["billion", "BILLIONAIRE (ALSO ON PAPER)", "HAVE 1,000,000,000 COINS", (s) => s.coins >= 1e9],
    ["gems1", "SHINY!", "OWN A DIAMOND", (s) => s.gems >= 1],
    ["gems100", "DRAGON HOARD", "HOLD 100 DIAMONDS AT ONCE", (s) => s.gems >= 100],
    ["ore100k", "STRIP MINER", "SELL 100,000 ORE IN TOTAL", (s, f) => f.oreSold >= 100_000],
    ["pick20", "SHARP", "UPGRADE THE PICK TO LV20", (s) => s.upgrades.pick >= 20],
    ["drill20", "INDUSTRIAL REVOLUTION", "UPGRADE THE DRILL TO LV20", (s) => s.upgrades.drill >= 20],
    ["cart20", "BIG BACK", "UPGRADE THE CART TO LV20", (s) => s.upgrades.cart >= 20],
    ["tap50k", "NO HANDS LEFT", "TAP THE ROCK 50,000 TIMES", (s, f) => f.taps >= 50_000],
    ["combo5k", "FINGERS OF GOD", "REACH A x5,000 COMBO", (s, f) => f.bestCombo >= 5000],
    ["combo6700", "WHAT?", "REACH A x6,700 COMBO", (s, f) => f.bestCombo >= 6700],
    ["combo10k", "BIG BANG THEORY", "REACH A x10,000 COMBO. YOUR KEYBOARD IS IN PAIN.", (s, f) => f.bestCombo >= 10000],
    ["bat100", "BAT COUNTRY", "CATCH 100 GOLDEN BATS", (s, f) => f.bats >= 100],
    ["chest500", "LOOT GOBLIN", "OPEN 500 CHESTS", (s) => s.stats.chestsOpened >= 500],
    ["chest25", "STACKED", `HOLD ${LUCK.maxChests} CHESTS AT ONCE. OPEN THEM?`, (s) => s.chests.length >= LUCK.maxChests],
    ["pets5", "PETTING ZOO", "OWN 5 PETS", (s) => s.pets.owned.length >= 5],
    ["chester", "IT HAS TEETH", "BUY CHESTER. COUNT YOUR FINGERS.", (s) => s.pets.owned.includes("chester")],
    ["dicey", "LOADED QUESTION", "USE LOADED DIE 10 TIMES", (s, f) => f.skill_dice >= 10],
    ["timelord", "TIME LORD", "USE TIME SKIP 10 TIMES", (s, f) => f.skill_hourglass >= 10],
    ["pat5k", "LOVE LANGUAGE: TOUCH", "PET YOUR PET 5,000 TIMES", (s, f) => f.pats >= 5000],
    ["harvest500", "AGRICULTURAL EMPIRE", "HARVEST 500 TIMES", (s, f) => f.harvests >= 500],
    ["trips50", "FREQUENT FLYER", "FINISH 50 EXPEDITIONS", (s, f) => f.trips >= 50],
    ["goldfruit", "FORBIDDEN FRUIT", "GROW A GOLD FRUIT", (s) => "goldfruit" in s.bag],
    ["drip", "DRIP OVERLOAD", "OWN EVERY SKIN", (s) => SKINS.every((k) => s.skins.owned.includes(k.id))],
    ["loud", "MY EARS!", "TURN THE VOLUME UP TO 200%", (s) => s.settings.volume >= 200],
    ["zen", "ZEN MASTER", "TURN ON CALM MODE", (s) => s.settings.calm],
    ["backup", "TRUST ISSUES", "COPY A SAVE BACKUP", (s, f) => f.backups >= 1],
    ["vipGold", "GOLD MEMBER", "REACH VIP GOLD", (s) => s.burned >= VIP[3].at],
    ["blackcard", "THE BLACK CARD", "REACH THE TOP VIP TIER", (s) => s.burned >= VIP[VIP.length - 1].at, true],
    ["vault1", "SAFECRACKER", "CRACK THE VAULT", (s) => s.vault.tier >= 1],
    ["vault11", "OCEAN'S ELEVEN", "CRACK 11 VAULTS", (s) => s.vault.tier >= 11],
    ["relicLeg", "INDIANA BONES", "OWN A LEGENDARY RELIC", (s) => s.relics.list.some((r) => r.rarity === "legendary")],
    ["star5", "ASCENDED", "TAKE ANY GEAR TO 5 STARS", (s) => Object.values(s.gear).some((lv) => lv >= GEAR_MAX + 5)],
    ["setOn", "MATCHING OUTFIT", "SWITCH ON A GEAR SET BONUS", (s) => GEAR_SETS.some((set) => set.gear.every((id) => (s.gear[id] ?? 0) >= GEAR_MAX + 3))],
    ["sixseven", "SIX SEVEN", "OWN SIX AND SEVEN. YOU KNOW WHAT YOU DID.", (s) => ["digit6", "digit7"].every((id) => s.pets.owned.includes(id))],
    // ---- round three: filling the gaps ----
    ["lv20", "VETERAN", "REACH LV20", (s) => s.level >= 20],
    ["lv30", "ELDER", "REACH LV30", (s) => s.level >= 30],
    ["lv50", "ANCIENT ONE", "REACH LV50", (s) => s.level >= 50],
    ["spin100k", "THE REELS ARE YOU NOW", "SPIN 100,000 TIMES", (s) => s.stats.spins >= 100_000],
    ["perfect5k", "PIXEL PERFECT", "GET 5,000 PERFECTS", (s) => s.stats.perfects >= 5000],
    ["bet1m", "MILLION COIN SPIN", "BET 1,000,000 ON ONE SPIN", (s, f) => f.bigBet >= 1e6],
    ["vipSilver", "SILVER SPOON", "REACH VIP SILVER", (s) => s.burned >= VIP[2].at],
    ["vipPlat", "PLATINUM PLUS", "REACH VIP PLATINUM", (s) => s.burned >= VIP[4].at],
    ["vault5", "VAULT HUNTER", "CRACK 5 VAULTS", (s) => s.vault.tier >= 5],
    ["vault20", "FORT KNOX WHO?", "CRACK 20 VAULTS", (s) => s.vault.tier >= 20],
    ["relic3", "FULLY ACCESSORIZED", "WEAR 3 RELICS AT ONCE", (s) => s.relics.equipped.every(Boolean)],
    ["relicCase", "MUSEUM CURATOR", `FILL THE RELIC CASE (${RELICS.cap})`, (s) => s.relics.list.length >= RELICS.cap],
    ["rerolls", "RNG ADDICT", "REROLL RELICS 25 TIMES", (s, f) => f.rerolls >= 25],
    ["dust100", "DUST TO DUST", "HOLD 100 RELIC DUST", (s) => (s.bag.relicDust ?? 0) >= 100],
    ["gems500", "DIAMOND HANDS", "HOLD 500 DIAMONDS", (s) => s.gems >= 500],
    ["chest2k", "CHEST PAIN", "OPEN 2,000 CHESTS", (s) => s.stats.chestsOpened >= 2000],
    ["legendChest", "GOLDEN TICKET", "OPEN A LEGENDARY CHEST", (s, f) => f.legendaryChests >= 1],
    ["brewAll", "ALCHEMIST", "BREW EVERY KIND OF BREW", (s, f) => BREWS.every((b) => f[`brew_${b.id}`])],
    ["brew50", "POTION SELLER", "DRINK 50 BREWS. MY POTIONS ARE TOO STRONG FOR YOU", (s, f) => f.brews >= 50],
    ["midas", "THE MIDAS TOUCH", "DRINK A MIDAS BREW", (s, f) => f.midas >= 1],
    ["gearAll5", "FULLY FORGED", "EVERY PIECE OF GEAR AT LV5", (s) => GEAR.every((g) => (s.gear[g.id] ?? 0) >= GEAR_MAX)],
    ["setAll", "FASHION WEEK", "SWITCH ON EVERY GEAR SET", (s) => GEAR_SETS.every((set) => set.gear.every((id) => (s.gear[id] ?? 0) >= GEAR_MAX + 3))],
    ["ascendAll", "ASCENSION COMPLETE", "EVERY PIECE OF GEAR AT 5 STARS", (s) => GEAR.every((g) => (s.gear[g.id] ?? 0) >= GEAR_MAX + 5), true],
    ["houston", "HOUSTON, WE HAVE LOOT", "FINISH A TRIP TO SPACE", (s, f) => f.trip_space >= 1],
    ["trips200", "DIGGS NEEDS A VACATION", "FINISH 200 EXPEDITIONS", (s, f) => f.trips >= 200],
    ["goldfruit10", "GOLDEN HARVEST", "HARVEST 10 GOLD FRUITS", (s, f) => f.goldfruits >= 10],
    ["junk10", "ONE MAN'S TRASH", "FIND 10 KINDS OF JUNK", (s) => JUNK.filter((id) => id in s.bag).length >= 10],
    ["junkAll", "...IS ANOTHER MAN'S TRASH TOO", "FIND EVERY KIND OF JUNK", (s) => JUNK.every((id) => id in s.bag)],
    ["completionist", "COMPLETIONIST", "FIND EVERY ITEM IN THE GAME", (s) => Object.keys(ITEMS).every((id) => id in s.bag)],
    ["pets10", "ZOOKEEPER", "OWN 10 PETS", (s) => s.pets.owned.length >= 10],
    ["skills100", "SKILL ISSUE? NEVER HEARD OF IT", "USE PET SKILLS 100 TIMES", (s, f) => f.skills >= 100],
    // ---- memes and nonsense ----
    ["nice", "NICE.", "HAVE EXACTLY 69 COINS", (s) => s.coins === 69, true],
    ["leet", "1337 H4X0R", "HAVE EXACTLY 1,337 COINS", (s) => s.coins === 1337, true],
    ["coins67", "6-7?", "HAVE EXACTLY 67 COINS. SIX. SEVEN.", (s) => s.coins === 67, true],
    ["clock67", "SIX SEVEN O'CLOCK", "PLAY AT 6:07", (s, f, d) => d.getHours() % 12 === 6 && d.getMinutes() === 7, true],
    ["combo67", "67 COMBO. YOU KNOW WHY.", "END A COMBO AT EXACTLY x67", (s, f) => f.combo67 >= 1, true],
    ["stonks", "STONKS", "WIN 1,000,000 COINS ON ONE SPIN", (s) => s.stats.bestWin >= 1e6],
    ["notStonks", "NOT STONKS", "LOSE 100 SPINS IN A ROW", (s, f) => f.worstStreak >= 100, true],
    ["damage", "EMOTIONAL DAMAGE", "LOSE 1,000,000 COINS TO THE MACHINE IN TOTAL", (s, f) => f.coinsLost >= 1e6],
    ["joever", "IT'S JOEVER", "GO BROKE 10 TIMES", (s, f) => f.brokes >= 10],
    ["soBack", "WE'RE SO BACK", "GO BROKE, THEN HAVE 100,000 COINS", (s, f) => f.brokes >= 1 && s.coins >= 100_000],
    ["sheesh", "SHEEEEESH", "WIN 100x YOUR BET IN ONE SPIN", (s) => s.stats.bestMult >= 100],
    ["luckyNotGood", "LUCKY, NOT GOOD", "WIN 10,000+ COINS ON A MISS", (s, f) => f.missWin >= 1],
    ["skillIssue", "SKILL ISSUE", "MISS THE ZONE 20 TIMES IN A ROW", (s, f) => f.bestMissRun >= 20],
    ["goated", "GOATED", "25 PERFECTS IN A ROW", (s, f) => f.bestPerfRun >= 25],
    ["hesitation", "HESITATION IS DEFEAT", "LET THE METER STOP BY ITSELF 100 TIMES", (s, f) => f.slow >= 100],
    ["dejavu", "DEJA VU", "LAND THE EXACT SAME REELS TWICE IN A ROW", (s, f) => f.dejavu >= 1],
    ["npc", "NPC BEHAVIOR", "LET AUTO SPIN DO 500 SPINS FOR YOU", (s, f) => f.autoSpins >= 500],
    ["sigma", "SIGMA GRINDSET", "KEEP THE POPUP OPEN FOR 2 HOURS STRAIGHT", (s, f, d, x) => x.session >= 7200],
    ["speedrun", "ANY% SPEEDRUN", "REACH LV10 WITHIN AN HOUR OF STARTING", (s, f) => f.bornAt > 0 && s.level >= 10 && Date.now() - f.bornAt < HOUR * 1000],
    ["grassMyth", "GRASS IS A MYTH", "OPEN THE GAME 1,000 TIMES", (s, f) => f.opens >= 1000],
    ["afk", "AFK", "STAY AWAY FOR 30 DAYS. WELCOME BACK, LEGEND.", (s, f) => f.longestAway >= 30 * DAY, true],
    ["insomnia", "3:33 AM", "PLAY AT 3:33 AM. WHY ARE YOU AWAKE?", (s, f, d) => d.getHours() === 3 && d.getMinutes() === 33, true],
    ["friday13", "PARASKEVIDEKATRIAPHOBIA", "PLAY ON A FRIDAY THE 13TH", (s, f, d) => d.getDay() === 5 && d.getDate() === 13, true],
    ["clickbait", "YOU WON'T BELIEVE #7", "OPEN THE TROPHY LIST 10 TIMES", (s, f) => f.listViews >= 10],
    ["lost", "ARE YOU LOST?", "OPEN THE MENU 50 TIMES", (s, f) => f.menu >= 50],
    ["wolf", "THE WOLF OF ORE STREET", "SELL ORE 500 TIMES", (s, f) => f.sells >= 500],
    ["mainChar", "MAIN CHARACTER ENERGY", "WEAR THE PLAY ITSELF SKIN", (s) => s.skins.active === "casino"],
    ["silent", "SILENT BUT DEADLY", "TURN THE VOLUME DOWN TO 0%", (s) => s.settings.volume === 0],
    ["petEnough", "OK THAT'S ENOUGH", "PET YOUR PET 1,000 TIMES", (s, f) => f.pats >= 1000],
    ["richRocks", "WHO NEEDS MONEY", "HAVE MORE DIAMONDS THAN COINS", (s) => s.gems > 0 && s.gems > s.coins, true],
    // ---- round four: certified brainrot ----
    ["lockIn", "LOCKED IN", "10 PERFECTS IN A ROW", (s, f) => f.bestPerfRun >= 10],
    ["cooked", "CHAT, AM I COOKED?", "GO BROKE ON A 1,000+ BET", (s, f) => f.cooked >= 1],
    ["letHimCook", "LET HIM COOK", "WIN 15 SPINS IN A ROW", (s, f) => f.bestWinRun >= 15],
    ["crashOut", "CRASH OUT", "PRESS ESC 100 TIMES. BREATHE.", (s, f) => f.esc >= 100],
    ["delulu", "DELULU IS THE SOLULU", "SPIN WITH LESS THAN ONE BET LEFT, 25 TIMES", (s, f) => f.delulu >= 25],
    ["chillGuy", "JUST A CHILL GUY", "CALM MODE AND AUTO SPIN AT THE SAME TIME", (s) => s.settings.calm && s.auto],
    ["mogged", "MOGGED", "WIN 10,000,000 COINS ON ONE SPIN", (s) => s.stats.bestWin >= 1e7],
    ["fanumTax", "FANUM TAX", "LET CHESTER EAT 100 CHESTS", (s, f) => f.chesterAte >= 100],
    ["ragebait", "RAGE BAIT", "3 NEAR MISSES IN A ROW", (s, f) => f.bestNearRun >= 3],
    ["ohio", "ONLY IN OHIO", "GO BROKE WHILE VIP GOLD OR HIGHER", (s) => s.coins <= 0 && s.burned >= VIP[3].at, true],
    ["unc", "UNC STATUS", "PLAY ON 30 DIFFERENT DAYS", (s, f) => f.days >= 30],
    ["rentFree", "LIVING RENT FREE", "OPEN THE GAME 20 TIMES IN ONE DAY", (s, f) => f.dayOpens >= 20],
    ["yapper", "CERTIFIED YAPPER", "REPLAY DIGGS' TOUR 3 TIMES", (s, f) => f.tours >= 3],
    ["clanker", "CLANKER", "LET AUTO SPIN DO 2,000 SPINS. BEEP BOOP.", (s, f) => f.autoSpins >= 2000],
    ["slop", "YOUR SLOP BORES ME", "SALVAGE 25 RELICS", (s, f) => f.salvaged >= 25],
    ["nihilist", "NIHILIST PENGUIN", "SOUND OFF, CALM ON, FRAME LIGHTS OFF. NOTHING MATTERS.", (s) => !s.sound && s.settings.calm && !s.settings.frame],
    ["grrMondays", "GRR MONDAYS", "PLAY ON A MONDAY BEFORE 9 AM", (s, f, d) => d.getDay() === 1 && d.getHours() < 9, true],
    ["octoberMe", "OCTOBER IS ALL ABOUT ME", "PLAY IN OCTOBER. MAIN CHARACTER MONTH.", (s, f, d) => d.getMonth() === 9],
    ["day67", "6/7 DAY", "PLAY ON JUNE 7TH", (s, f, d) => d.getMonth() === 5 && d.getDate() === 7, true],
    ["demure", "VERY DEMURE, VERY MINDFUL", "BET THE SMALLEST AMOUNT 100 TIMES", (s, f) => f.minBets >= 100],
    ["wRizz", "W RIZZ", "PET 5 DIFFERENT PETS", (s, f) => PETS.filter((p) => f[`pat_${p.id}`]).length >= 5],
    ["sevenSquared", "7X7=49", "HEAR ME OUT: HAVE EXACTLY 49 DIAMONDS", (s) => s.gems === 49, true],
    ["ten", "ACHIEVEMENT FOR ACHIEVEMENTS", "UNLOCK 10 ACHIEVEMENTS", (s, f, d, x) => x.count >= 10],
    ["half", "HALFWAY TO NOWHERE", "UNLOCK HALF OF THEM", (s, f, d, x) => x.count >= Math.floor(LIST.length / 2)],
    ["all", "NOW WHAT?", "UNLOCK EVERYTHING ELSE", (s, f, d, x) => x.count >= LIST.length - 1],
].map(([id, name, desc, test, secret = false]) => ({ id, name, desc, test, secret }));

export function createAchievements() {
    const el = { list: $("trophy-list"), summary: $("trophy-summary") };
    const sessionStart = Date.now();
    const queue = [];
    let flushTimer = 0;
    let checking = false;

    const f = () => state.fun;
    const unlocked = () => Object.keys(state.achv).length;
    f().bornAt ??= state.level <= 1 && !state.stats.spins ? Date.now() : 0;
    const today = new Date().toDateString();
    if (f().lastDay !== today) Object.assign(f(), { lastDay: today, days: (f().days ?? 0) + 1, dayOpens: 0 });
    f().dayOpens = (f().dayOpens ?? 0) + 1;

    function bump(key, n = 1) {
        f()[key] = (f()[key] ?? 0) + n;
        check();
    }

    const best = (key, value) => {
        f()[key] = Math.max(f()[key] ?? 0, value);
        check();
    };

    function check() {
        if (checking) return;
        checking = true;
        const now = new Date();
        const extra = { session: (Date.now() - sessionStart) / 1000 };
        if (state.coins <= 0 && !f().wasBroke) f().brokes = (f().brokes ?? 0) + 1;
        f().wasBroke = state.coins <= 0 ? 1 : 0;
        const fresh = [];
        let found = true;
        while (found) {
            found = false;
            extra.count = unlocked();
            for (const a of LIST) {
                if (state.achv[a.id] || !a.test(state, new Proxy(f(), ZERO), now, extra)) continue;
                state.achv[a.id] = Date.now();
                fresh.push(a);
                found = true;
            }
        }
        if (fresh.length) {
            commit();
            queue.push(...fresh);
            clearTimeout(flushTimer);
            flushTimer = setTimeout(announce, 300);
            if (!el.list.closest("[hidden]")) renderList();
        }
        checking = false;
    }

    // One toast per trophy, so nothing blocks play. A big burst shows the first few, then one "+N MORE" toast.
    function announce() {
        const batch = queue.splice(0);
        sfx.trophy();
        const shown = batch.length > TOAST_MAX ? batch.slice(0, TOAST_MAX - 1) : batch;
        shown.forEach((a) => toast({ icon: "i-trophy", tag: TEXT.trophyUnlocked, title: a.name, text: a.desc }));
        if (shown.length < batch.length) toast({ icon: "i-trophy", title: TEXT.trophiesMore(batch.length - shown.length), text: TEXT.trophiesMoreHint });
    }

    // Grouped by tag, each group with its own progress and its own #01, #02... count.
    function renderList() {
        const count = unlocked();
        el.summary.innerHTML = `<b>${count}/${LIST.length}</b><span>${TEXT.trophyTotal(econ.formatNumber(count * 1000))}</span>`;
        const tagged = new Set(TAGS.flatMap((t) => t.ids));
        const groups = [...TAGS, { name: "MISC", color: "S", ids: LIST.filter((a) => !tagged.has(a.id)).map((a) => a.id) }];
        el.list.innerHTML = groups
            .map((g) => {
                const list = LIST.filter((a) => g.ids.includes(a.id));
                if (!list.length) return "";
                const got = list.filter((a) => state.achv[a.id]).length;
                const rows = list.map((a, i) => {
                    const done = !!state.achv[a.id];
                    const hide = !done && a.secret;
                    return `<div class="tr-row" data-got="${done}" data-id="${a.id}">
                        <span class="tr-num">#${String(i + 1).padStart(2, "0")}</span>
                        <span class="tr-badge">${svgIcon("i-trophy", 2)}</span>
                        <span class="tr-text"><b>${hide ? "???" : a.name}</b><small>${hide ? TEXT.trophySecret : a.desc}</small></span>
                        <span class="tr-tag">${g.name}</span>
                    </div>`;
                });
                return `<section class="tr-group" style="--tone:${PALETTE[g.color]}">
                    <h3><span>${g.name}</span><small>${got}/${list.length}</small></h3>
                    ${rows.join("")}
                </section>`;
            })
            .join("");
    }

    function showList() {
        renderList();
        bump("listViews");
        if (!f().sawList) bump("sawList");
    }

    function spin({ tier, bet, grade, win = 0, symbols = [] }) {
        if (!bet) return bump("practice");
        const lost = tier === "lose" || tier === "near";
        const roll = symbols.join();
        if (roll && roll === f().lastRoll) f().dejavu = 1;
        f().lastRoll = roll;
        if (lost) f().coinsLost = (f().coinsLost ?? 0) + bet;
        if (lost && bet >= 1000 && state.coins <= 0) f().cooked = 1;
        f().nearRun = tier === "near" ? (f().nearRun ?? 0) + 1 : 0;
        f().bestNearRun = Math.max(f().bestNearRun ?? 0, f().nearRun);
        if (bet === 1) f().minBets = (f().minBets ?? 0) + 1;
        if (state.coins < bet) f().delulu = (f().delulu ?? 0) + 1;
        if (grade === "miss" && win >= 10_000) f().missWin = 1;
        if (state.auto) f().autoSpins = (f().autoSpins ?? 0) + 1;
        f().lossStreak = lost ? (f().lossStreak ?? 0) + 1 : 0;
        if (tier === "near") f().near = (f().near ?? 0) + 1;
        f().winRun = lost ? 0 : (f().winRun ?? 0) + 1;
        if (tier === "jackpot") {
            f().jackpot = 1;
            f().jackpots = (f().jackpots ?? 0) + 1;
        }
        f().bigBet = Math.max(f().bigBet ?? 0, bet);
        f().bestWinRun = Math.max(f().bestWinRun ?? 0, f().winRun);
        best("worstStreak", f().lossStreak);
    }

    el.list.addEventListener("click", (e) => {
        const row = e.target.closest('.tr-row[data-got="false"]');
        if (!row) return;
        sfx.denied();
        fx.shake(row, 2, 200);
        bump("impatient");
    });

    on("tap", () => bump("taps"));
    on("tap-full", () => bump("tapFull"));
    on("sell", ({ amount }) => {
        f().sells = (f().sells ?? 0) + 1;
        f().oreSold = (f().oreSold ?? 0) + amount;
        if (amount === 1) f().sellOne = 1;
        best("bestSell", amount);
    });
    on("stop", ({ grade, timedOut }) => {
        f().perfRun = grade === "perfect" ? (f().perfRun ?? 0) + 1 : 0;
        f().missRun = grade === "miss" ? (f().missRun ?? 0) + 1 : 0;
        f().bestMissRun = Math.max(f().bestMissRun ?? 0, f().missRun);
        best("bestPerfRun", f().perfRun);
        if (timedOut) bump("slow");
    });
    on("bet-change", () => bump("betChanges"));
    on("bet-stuck", ({ delta }) => delta > 0 && bump("betStuck"));
    on("combo", ({ count }) => best("bestCombo", count));
    on("pat", ({ id }) => bump(`pat_${id}`));
    on("chester-eat", ({ count }) => bump("chesterAte", count));
    on("relic-salvage", () => bump("salvaged"));
    on("tour-replay", () => bump("tours"));
    on("pet-buy", () => check());
    on("pet-equip", () => bump("swaps"));
    on("skill", ({ id }) => {
        f().skills = (f().skills ?? 0) + 1;
        bump(`skill_${id}`);
    });
    on("chest-open", ({ rarity }) => rarity === "legendary" && bump("legendaryChests"));
    on("relic-reroll", () => bump("rerolls"));
    on("brew", ({ id }) => bump(`brew_${id}`));
    on("combo", ({ count }) => count === 67 && bump("combo67"));
    on("craft", () => bump("crafts"));
    on("brew-use", ({ id }) => {
        if (id === "midasBrew") f().midas = 1;
        bump("brews");
    });
    on("harvest", ({ loot }) => {
        f().goldfruits = (f().goldfruits ?? 0) + (loot.goldfruit ?? 0);
        bump("harvests");
    });
    on("trip", ({ zone, minutes, early, found }) => {
        if (!found) f().naps = 1;
        if (early) return bump("recalls");
        f()[`trip_${zone}`] = 1;
        if (minutes >= 240) f().trip8h = 1;
        bump("trips");
    });

    return { bump, best, check, spin, showList };
}

// Trophy list groups, in display order. Anything not listed falls into MISC.
const TAGS = [
    ["TIME", "c", "hello regular grass opens500 owl midnight earlybird lunch friday monday weekend newyear halloween xmas pi away8 away3d away7d marathon marathon30"],
    ["SLOT", "y", "spin1 spin500 spin5k spin25k spin100k perfect perfect500 perfect5k bet1m perfRun5 perfRun15 timed1k winRun5 winRun10 near near100 lose10 lose25 lose50 slow practice practice500 highroller maxbet jackpot jackpot5 cosmic cosmic5 bigwin heatmax burn1m wiggle stuck autopilot"],
    ["MINE", "l", "tap1k tap10k tap50k full sellOne sell1k ore10k ore100k combo500 combo2k combo5k combo6700 combo10k pick20 drill20 cart20"],
    ["LOOT", "O", "bat bat100 chest chest500 chest2k chest25 legendChest junk10 junkAll completionist"],
    ["WEALTH", "G", "lv5 lv15 lv20 lv30 lv50 broke seven balanced million billion gems1 gems100 gems500"],
    ["PETS + SKINS", "R", "pet1 pets5 pets10 petAll skills100 rock fruit fluff napper clock chester dicey timelord sixseven pat50 pat500 pat5k swap toast office meta drip"],
    ["FARM + FORGE", "g", "wander tourist houston trips50 trips200 goldfruit10 brewAll brew50 midas gearAll5 setAll ascendAll abandon helicopter nap thumb farmville harvest500 goldfruit craft overkill loaded star5 setOn potion hoarder spacerock"],
    ["ENDGAME", "v", "vipSilver vipGold vipPlat blackcard vault1 vault5 vault11 vault20 relicLeg relic3 relicCase rerolls dust100"],
    ["MEMES", "B", "lockIn cooked letHimCook crashOut delulu chillGuy mogged fanumTax ragebait ohio unc rentFree yapper clanker slop nihilist grrMondays octoberMe day67 demure wRizz sevenSquared nice leet coins67 clock67 combo67 stonks notStonks damage joever soBack sheesh luckyNotGood skillIssue goated hesitation dejavu npc sigma speedrun grassMyth afk insomnia friday13 clickbait lost wolf mainChar silent petEnough richRocks"],
    ["JUST BECAUSE", "P", "dj mute loud zen backup esc manual history reset clicks keys impatient nothing ten half all"],
].map(([name, color, ids]) => ({ name, color, ids: ids.split(" ") }));

// Missing counters read as 0 so tests never see undefined.
const ZERO = { get: (target, key) => target[key] ?? 0 };
