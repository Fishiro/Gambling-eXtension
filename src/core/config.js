// `easy` symbols are the cheap, frequent wins: only EASY_KEEP of the lines they make actually land; the rest
// slip into a near miss (economy.rollReels). Every other line keeps its plain weight odds.
export const SYMBOLS = [
    { id: "cherry", name: "CHERRY", weight: 30, pair: 1, triple: 5, easy: true },
    { id: "lemon", name: "LEMON", weight: 25, pair: 1, triple: 8, easy: true },
    { id: "bell", name: "BELL", weight: 18, pair: 3, triple: 12, easy: true },
    { id: "clover", name: "CLOVER", weight: 13, pair: 5, triple: 25 },
    { id: "gem", name: "GEM", weight: 9, pair: 8, triple: 50 },
    { id: "seven", name: "SEVEN", weight: 5, pair: 15, triple: 150 },
];

export const EASY_KEEP = 0.5;

// Any whole bet from 0 up to the level's cap can be typed in. The cap starts at `first` and grows by `growth`
// per level (rounded to 2 significant digits) up to `max` (LV19), which nothing raises, VIP included.
// `steps` are the stops the -/+ buttons and arrow keys jump between.
export const BET = {
    first: 5,
    growth: 2,
    max: 1_000_000,
    steps: [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
};

export const START = { coins: 100, bet: 5 };

export const BREAK_SECONDS = 5 * 60;

export const TIMING = {
    minSpinMs: 280,
    autoStopMs: 2400,
    grades: {
        perfect: { mult: 1.25, xp: 1.4, skill: 1 },
        good: { mult: 1.1, xp: 1.05, skill: 0.6 },
        miss: { mult: 1, xp: 0.7, skill: 0 },
    },
    heatStep: 0.05,
    heatMax: 5,
    // Zone width and sweep speed follow difficulty(level) (economy.js) from `base` to `hard`; min/max clamp the
    // adaptive nudge on top.
    zone: { base: 0.34, hard: 0.1, min: 0.08, max: 0.45 },
    speed: { base: 0.8, hard: 2.2, min: 0.6, max: 2.4 },
    // Sawtooth difficulty: the trend climbs to 1 at peakLevel (front-loaded by `shape` < 1). Each `chapter`
    // levels rise by `tooth` from start to end, so a new chapter opens a little easier than the last peak,
    // and every peak sits higher than the one before.
    curve: { peakLevel: 26, shape: 0.85, chapter: 5, tooth: 0.12 },
    perfectRatio: 0.3,
    skillTarget: 0.6,
    skillSmoothing: 0.25,
    adaptStrength: 0.35,
};

// Features open by level, so a new player meets one thing at a time. Each comes with its own short tour.
// Levels 7-10 keep the drip going: the vault at 7, relics at 10.
export const UNLOCKS = [
    // Open from the start: new players meet it in the first tour, older saves get its own tour once.
    { id: "market", level: 1, name: "MARKET" },
    { id: "bag", level: 2, name: "BAG + SKINS" },
    { id: "pets", level: 3, name: "PETS" },
    { id: "farm", level: 4, name: "FARM" },
    { id: "forge", level: 5, name: "FORGE" },
    { id: "vault", level: 7, name: "VIP + VAULT" },
    { id: "relics", level: 10, name: "RELICS" },
];

// XP is logarithmic in the stake: xpForStake(x) = xpScale * ln(1 + x / xpUnit). Ten times the bet is only
// ~+2.3 x xpScale more XP, so big bets help a little instead of inflating levels.
// A level costs spinsBase * spinsGrowth^(level - 1) GOOD spins at that level's top (non-VIP) bet, so the pace is
// set in spins, the thing a player actually feels, and stays the same whatever the bet table looks like.
// Mining XP is a trickle: everything sold in one market minute counts together, worth sellXp spins staking the
// coins it brought (core/market.sellXpFor), so splitting or spamming sales earns nothing extra.
export const LEVELS = {
    xpScale: 10,
    xpUnit: 10,
    spinsBase: 8,
    spinsGrowth: 1.1,
    sellXp: 0.5,
    coinRewardPerLevel: 25,
};

// Overheat: each tap adds 1 heat, `rest` heat cools off per second. Past `free` heat each tap loses 1/span
// of its yield, down to `floor`. Steady tapping (~rest taps/s) never overheats; frantic spam does.
// XP for selling comes from the coins it brought (see LEVELS.sellXp), so a dump at a bad price earns less.
// Upgrades: value = (base + step * lv) * compound^lv, cost = cost * growth^lv. Value compounds too, so the
// payback time of each level grows slowly (growth / compound per level) instead of hitting a wall.
export const MINE = {
    orePrice: 1,
    overheat: { rest: 4, free: 6, span: 18, floor: 0.25 },
    luckyChance: 0.06,
    luckyMult: 5,
    // The live ORE/MIN readout: the drill plus what taps dug over the last rateWindowSeconds, redrawn once a second.
    rateWindowSeconds: 3,
    upgrades: {
        pick: { name: "PICK", unit: "/TAP", cost: 20, growth: 1.5, base: 1, step: 1, compound: 1.12 },
        drill: { name: "DRILL", unit: "/MIN", cost: 35, growth: 1.55, base: 6, step: 5, compound: 1.12 },
        cart: { name: "CART", unit: " CAP", cost: 25, growth: 1.5, base: 100, step: 100, compound: 1.1 },
    },
};

// The ore market. The price only changes once a tick (a minute): everything sold during a tick pays that
// tick's price. At the close, a phase pushes the base (drift + noise), `revert` pulls it back toward x1,
// a `jolt` sometimes kicks it up or down hard, and a `spike` phase jumps it when it starts.
// Selling past freeCarts in one tick adds glut (dump * extraCarts^dumpCurve). Glut doesn't hit at once:
// `drag` closes dragRate of the gap to the glut each tick, and the price paid is base * e^-drag, so a dump
// slides the price down over the next minutes, and steady dumping sinks it to pennies. Each tick keeps
// glutKeep of the glut. A light sell (up to demandUpTo of a cart) nudges the next tick up.
export const MARKET = {
    tickSeconds: 60,
    history: 30,
    floor: 0.25,
    cap: 3.5,
    dump: 0.2,
    dumpCurve: 1.5,
    freeCarts: 1,
    glutKeep: 0.65,
    dragRate: 0.25,
    jolt: { chance: 0.15, size: 0.35 },
    demandUpTo: 0.5,
    demandBump: 0.03,
    catchUpTicks: 240,
    phases: [
        { id: "calm", name: "CALM", weight: 40, drift: 0, vol: 0.03, revert: 0.3, ticks: [3, 6], color: "l" },
        { id: "bull", name: "BULL RUN", weight: 22, drift: 0.06, vol: 0.04, revert: 0.1, ticks: [3, 6], color: "G" },
        { id: "bear", name: "BEAR", weight: 22, drift: -0.05, vol: 0.04, revert: 0.1, ticks: [3, 6], color: "R" },
        { id: "boom", name: "BOOM!", weight: 8, drift: 0.2, vol: 0.06, revert: 0, ticks: [2, 3], color: "y", loud: true },
        { id: "crash", name: "CRASH!", weight: 8, drift: -0.15, vol: 0.05, revert: 0, ticks: [2, 3], color: "r", loud: true },
        { id: "moon", name: "TO THE MOON", weight: 6, drift: 0, vol: 0.05, revert: 0.15, ticks: [2, 2], spike: [1.5, 2], color: "c", loud: true },
    ],
};

export const LUCK = {
    rarities: [
        { id: "common", name: "COMMON", weight: 30, color: "l" },
        { id: "rare", name: "RARE", weight: 14, color: "B" },
        { id: "epic", name: "EPIC", weight: 10, color: "v" },
        { id: "legendary", name: "LEGENDARY", weight: 2, color: "y" },
    ],
    rewards: {
        common: [{ type: "coins", mult: 3 }, { type: "ore", fill: 0.4 }, { type: "xp", frac: 0.15 }],
        rare: [{ type: "coins", mult: 8 }, { type: "freeSpin" }, { type: "heat", amount: 3 }, { type: "ore", fill: 1 }],
        epic: [{ type: "goldRush", seconds: 90 }, { type: "hotMachine", spins: 8 }, { type: "coins", mult: 20 }, { type: "item", id: "goldseed", n: 1 }, { type: "gems", n: 1 }],
        legendary: [{ type: "coins", mult: 40 }, { type: "bundle" }, { type: "gems", n: 5 }, { type: "relic" }],
    },
    fallbackMult: { ore: 3, freeSpin: 8, bundle: 15 },
    // Every chest also drops seeds on top of its reward, the garden's steady supply: `seed` plain seeds and a
    // `gold` chance at one gold seed, by rarity.
    chestSeeds: {
        common: { seed: 1, gold: 0.02 },
        rare: { seed: 2, gold: 0.05 },
        epic: { seed: 3, gold: 0.25 },
        legendary: { seed: 4, gold: 1 },
    },
    // Coins in chests (and junk scrap) are counted in units of coinPerLevel x level, never the bet: a big bet is
    // pure risk, chests can't pay it back.
    coinPerLevel: 25,
    maxChests: 25,
    legendaryBoost: 100,
    chestPerTap: 0.006,
    // Every bet spin (any bet above 0, any size) has exactly this chance of one chest. Nothing raises it and a
    // spin never gives more than one: chests must not turn big bets into a safe bet. A GEM/SEVEN triple or a
    // double star makes that chest blessed. (The chest stat only feeds mine taps.)
    chestPerSpin: 0.1,
    chestTripleSymbols: ["gem", "seven"],
    awayMinutesPerChest: 40,
    awayMaxChests: 3,
    batMeanSeconds: 150,
    batSeconds: 5,
    batBoost: 1,
    tripleBoost: 2,
    // Bad-luck protection: after this many chests in a row below a rarity, the next one is that rarity.
    pity: { epic: 15, legendary: 60 },
    luckySpinChance: 0.04,
    luckySpinMult: 2,
    hotMachineMult: 1.5,
    goldRushMult: 3,
};

export const COSMIC = {
    odds: [0, 1 / 150, 1 / 1000, 1 / 20000],
    perfectMult: 2,
    single: { scatter: 2, lineMult: 2 },
    double: { scatter: 15, chestBoost: 2 },
    payout: 777,
    chests: 3,
    chestBoost: 6,
    goldRushSeconds: 180,
    hotSpins: 20,
};

export const HISTORY = { max: 60, hallSize: 5 };

const MIN = 60 * 1000;

// Pets: up to PET_SLOTS.length equipped at once (the first slot is free, the rest cost diamonds). Each has a
// skill (auto, or tap with Q) plus a passive bonus while equipped; `passive` feeds the same stats as gear
// (see items.bonus). `role` groups them by play style. Prices assume the post-market economy: helpers cost
// ~10-20 min of play when pets open (LV3), playstyle pets ~30-60 min at mid levels, legends are hours-long goals.
export const PET_SLOTS = [0, 15, 40];
// Pets only ever raise odds, they never force a result. SEVEN's buff makes 7-7-7 exactly `jackpotMax` likely
// on a spin (the natural odds included); DICEY and SIX bend a dead roll into a pair `bendChance` of the time.
export const PET_REEL = { jackpotMax: 0.025, bendChance: 0.3 };
export const PET_ROLES = {
    buddy: { name: "BUDDY", color: "O", desc: "CHEAP, WITH A TINY BONUS" },
    helper: { name: "HELPER", color: "c", desc: "DOES THE CHORES" },
    slot: { name: "SLOT", color: "y", desc: "BETTER SPINS" },
    mine: { name: "MINE", color: "l", desc: "DIG AND SELL" },
    idle: { name: "IDLE", color: "G", desc: "WORKS WHILE AWAY" },
    legend: { name: "LEGEND", color: "v", desc: "THE BIG GOALS" },
};
export const PETS = [
    // Buddies: cheap first pets, each with a tiny passive.
    {
        id: "worker",
        role: "buddy",
        name: "WORKER",
        kind: "INTERN",
        price: 500,
        skill: "NONE",
        auto: true,
        cooldown: 0,
        passive: { stat: "yield", per: 0.05, label: "GARDEN YIELD" },
        desc: "NO SKILL, NO THOUGHTS. WATERS THE GARDEN WHEN NOBODY IS LOOKING, SO HARVESTS COME IN A LITTLE BIGGER.",
        lines: ["...", "IS IT 5 YET?", "I'M ON BREAK", "NOT MY JOB", "UNPAID, UNBOTHERED"],
    },
    {
        id: "pebble",
        role: "buddy",
        name: "LIL PEBBLE",
        kind: "SMALLER ROCK",
        price: 800,
        skill: "SIT THERE",
        auto: true,
        cooldown: 0,
        passive: { stat: "drill", per: 0.05, label: "DRILL SPEED" },
        desc: "DWAYNE'S LITTLE COUSIN. IT SITS THERE. THE DRILL FEELS SLIGHTLY INSPIRED.",
        lines: ["...", "PEBBLE.", "I AM ALSO A ROCK", "SMOL ROCK ENERGY", "ROCK JR."],
    },
    {
        id: "socky",
        role: "buddy",
        name: "SOCKY",
        kind: "LONELY SOCK",
        price: 1_200,
        skill: "SNIFF AROUND",
        auto: true,
        cooldown: 0,
        passive: { stat: "yield", per: 0.1, label: "GARDEN YIELD" },
        desc: "LOST ITS PAIR IN THE DRYER. NOW IT SNIFFS AROUND THE GARDEN AND TURNS UP A FEW EXTRA CROPS.",
        lines: ["WHERE IS MY PAIR", "*SNIFF*", "I SMELL HERBS", "DRYER TOOK HIM", "LEFT FOOT ONLY"],
    },
    {
        id: "ducky",
        role: "buddy",
        name: "DUCKY",
        kind: "RUBBER DUCK",
        price: 2_000,
        skill: "QUACK",
        auto: true,
        cooldown: 0,
        passive: { stat: "zone", per: 0.03, label: "TIMING ZONE" },
        desc: "SQUEAKS WHEN YOU SPIN. THE TIMING ZONE GETS A TINY BIT WIDER, PROBABLY.",
        lines: ["QUACK", "*SQUEAK*", "QUACK QUACK", "I FLOAT", "DEBUG ME"],
    },
    {
        id: "snail",
        role: "buddy",
        name: "TURBO",
        kind: "SNAIL",
        price: 2_500,
        skill: "ZOOM",
        auto: true,
        cooldown: 0,
        passive: { stat: "grow", per: 0.05, label: "GROW SPEED" },
        desc: "THE FASTEST SNAIL ALIVE. STILL A SNAIL. CROPS GROW A LITTLE FASTER OUT OF PITY.",
        lines: ["ZOOM", "...ZOOM", "I AM SPEED", "GOTTA GO SLOW", "SPEEDRUN ANY%"],
    },
    {
        id: "spinny",
        role: "helper",
        name: "SPINNY",
        kind: "SLOT MACHINE",
        price: 1_500,
        skill: "AUTOPILOT",
        auto: true,
        cooldown: 0,
        autoGood: 0.5,
        desc: "UNLOCKS AUTO SPIN (A) WHILE EQUIPPED. ITS AUTO STOPS LAND IN THE GREEN HALF THE TIME, SO AFK SPINS ROUGHLY BREAK EVEN.",
        lines: ["*DING DING*", "ONE MORE SPIN", "I HAVE NO HANDS EITHER", "PULL MY LEVER", "LET IT RIDE"],
    },
    {
        id: "chester",
        role: "helper",
        name: "CHESTER",
        kind: "LIVING CHEST",
        price: 3_000,
        skill: "GREEDY LID",
        auto: true,
        cooldown: 0,
        desc: "AUTO: OPENS EVERY CHEST THE MOMENT IT LANDS IN YOUR STASH. NO WAITING, NO TAPPING.",
        lines: ["*CHOMP*", "MORE CHESTS", "I EAT LOCKS", "DON'T LOOK INSIDE ME", "FANUM TAX ON YOUR LOOT"],
    },
    {
        id: "banana",
        role: "helper",
        name: "SIR BANANA",
        kind: "FRUIT",
        price: 6_000,
        skill: "BAT SNATCHER",
        auto: true,
        cooldown: 15 * MIN,
        catchBoost: 3,
        awayMaxBats: 4,
        passive: { stat: "chest", per: 0.3, label: "CHEST CHANCE" },
        desc: "AUTO CATCHES THE GOLDEN BAT FOR A BLESSED CHEST (MUCH BETTER ODDS). KEEPS HUNTING WHILE YOU ARE AWAY, UP TO 4.",
        lines: ["I AM A BANANA", "PEEL ME? NO.", "POTASSIUM POWER", "BAT? SNACK.", "+1,000 AURA, POTASSIUM INCLUDED"],
    },
    {
        id: "frosty",
        role: "mine",
        name: "FROSTY",
        kind: "ICE CUBE",
        price: 8_000,
        skill: "BRAIN FREEZE",
        auto: false,
        cooldown: 10 * MIN,
        freezeSeconds: 60,
        passive: { stat: "cool", per: 0.5, label: "PICK COOLING" },
        desc: "TAP SKILL: FOR 60S THE PICK CAN'T OVERHEAT. SPAM AT FULL POWER. PASSIVE: THE PICK COOLS 50% FASTER.",
        lines: ["STAY FROSTY", "CHILL.", "I AM MELTING. SLOWLY.", "ICE ICE BABY", "COOL HEAD, HOT PICK"],
    },
    {
        id: "shroom",
        role: "idle",
        name: "SPORE",
        kind: "MUSHROOM",
        price: 10_000,
        skill: "SPORE SPREAD",
        auto: true,
        cooldown: 0,
        passive: { stat: "yield", per: 0.4, label: "GARDEN YIELD" },
        desc: "AUTO: A HARVESTED PLOT REPLANTS ITSELF WITH THE SAME SEED IF YOU HAVE ONE. SET UP THE GARDEN ONCE, FARM FOREVER.",
        lines: ["FUN GUY", "I LIVE IN THE DARK", "SPORES EVERYWHERE", "NOT THAT KIND", "LOWKENUINELY A FUN GUY"],
    },
    {
        id: "toaster",
        role: "mine",
        name: "TOASTY",
        kind: "APPLIANCE",
        price: 15_000,
        skill: "TOAST RUSH",
        auto: false,
        cooldown: 15 * MIN,
        rushSeconds: 300,
        passive: { stat: "drill", per: 0.5, label: "DRILL SPEED" },
        desc: "TAP SKILL: FILLS THE CART TO THE TOP, THEN 5 MIN GOLD RUSH (MINE x3).",
        lines: ["*DING*", "WARM. ALWAYS WARM.", "BREAD IS MY CARDIO", "DO NOT BATH WITH ME", "LET ME COOK"],
    },
    {
        id: "piggy",
        role: "slot",
        name: "OINKER",
        kind: "PIGGY BANK",
        price: 20_000,
        skill: "SAFETY NET",
        auto: true,
        cooldown: 2 * MIN,
        refund: 0.6,
        passive: { stat: "sell", per: 0.3, label: "ORE PRICE" },
        desc: "AUTO: REFUNDS 60% OF A LOST BET, ONCE EVERY 2 MIN. MAKES BIG BETS LESS SCARY.",
        lines: ["OINK", "SAVE THE COINS", "I HAVE A HOLE IN MY BACK", "*JINGLE*", "DELULU IS THE SOLULU"],
    },
    {
        id: "stonks",
        role: "mine",
        name: "STONKS",
        kind: "LINE GO UP",
        price: 30_000,
        skill: "PUMP IT",
        auto: false,
        cooldown: 20 * MIN,
        pump: 0.5,
        passive: { stat: "sell", per: 0.2, label: "ORE PRICE" },
        desc: "TAP SKILL: WIPES THE MARKET'S GLUT AND PUMPS THE PRICE +50%. DUMP A FULL CART RIGHT AFTER. NOT FINANCIAL ADVICE.",
        lines: ["STONKS", "LINE GO UP", "BUY HIGH SELL HIGHER", "DIAMOND HANDS", "TO THE MOON"],
    },
    {
        id: "bonsai",
        role: "slot",
        name: "LIL BONSAI",
        kind: "TREE",
        price: 40_000,
        skill: "ZEN ROOTS",
        auto: true,
        cooldown: 3 * MIN,
        passive: { stat: "zone", per: 0.2, label: "TIMING ZONE" },
        desc: "AUTO: A MISS DOES NOT PUT YOUR HEAT OUT. RECHARGES EVERY 3 MIN.",
        lines: ["...", "BREATHE IN", "I AM 400 YEARS OLD", "TRIM ME GENTLY", "VERY DEMURE, VERY MINDFUL"],
    },
    {
        id: "dice",
        role: "slot",
        name: "DICEY",
        kind: "LUCKY DIE",
        price: 50_000,
        skill: "LOADED DIE",
        auto: false,
        cooldown: 20 * MIN,
        loadedSpins: 5,
        passive: { stat: "payout", per: 0.1, label: "SLOT PAYOUT" },
        desc: "TAP SKILL: FOR YOUR NEXT 5 BET SPINS, A DEAD ROLL HAS A 30% CHANCE TO BECOME A PAIR. SAVE IT FOR BIG BETS.",
        lines: ["ROLL ME", "SNAKE EYES? NEVER.", "I AM ALWAYS SIX", "TOTALLY FAIR DIE", "RAGE BAIT? NAH. RNG."],
    },
    {
        id: "cat",
        role: "idle",
        name: "MEEMEE",
        kind: "FAT CAT",
        price: 75_000,
        skill: "NAP BANK",
        auto: true,
        cooldown: 0,
        napPerHour: 0.02,
        napCap: 0.2,
        napMinMinutes: 10,
        passive: { stat: "cart", per: 1, label: "CART SIZE" },
        desc: "AUTO: WHILE THE POPUP IS CLOSED MEEMEE NAPS ON YOUR COINS: +2% PER HOUR, UP TO +20%. PLAY LESS, EARN MORE.",
        lines: ["...ZZZ", "*PURR*", "FEED ME. THEN LEAVE.", "I AM NOT FAT, I AM FLUFF", "MOVE? NO.", "JUST A CHILL GUY", "SLEEPMAXXING"],
    },
    {
        id: "berry",
        role: "slot",
        name: "BERRY",
        kind: "FRUIT",
        price: 100_000,
        skill: "BERRY SPIN",
        auto: true,
        cooldown: 10 * MIN,
        hotSpins: 5,
        passive: { stat: "payout", per: 0.15, label: "SLOT PAYOUT" },
        desc: "AUTO: EVERY 10 MIN REFILLS YOUR FREE SPIN AND ADDS 5 HOT SPINS (x1.5), EVEN WHILE AWAY.",
        lines: ["BERRY NICE", "I HAVE 200 SEEDS", "SPIN ME RIGHT ROUND", "JAM IS MY FEAR", "IT'S GIVING SMOOTHIE"],
    },
    {
        id: "hourglass",
        role: "idle",
        name: "SANDY",
        kind: "HOURGLASS",
        price: 120_000,
        skill: "TIME SKIP",
        auto: false,
        cooldown: 30 * MIN,
        skipMinutes: 60,
        passive: { stat: "grow", per: 0.3, label: "GROW SPEED" },
        desc: "TAP SKILL: EVERY GROWING PLOT JUMPS 1 HOUR AHEAD. SAVE IT FOR A GOLD SEED.",
        lines: ["TICK TOCK", "I AM RUNNING OUT", "FLIP ME", "SAND IN EVERYTHING", "LOCK IN. TIME'S TICKING"],
    },
    {
        id: "rock",
        role: "slot",
        name: "DWAYNE",
        kind: "ROCK",
        price: 250_000,
        skill: "ROCK SOLID",
        auto: false,
        cooldown: 15 * MIN,
        perfectSpins: 10,
        passive: { stat: "payout", per: 0.35, label: "SLOT PAYOUT" },
        desc: "TAP SKILL: YOUR NEXT 10 BET SPINS ARE PERFECT, NO MATTER WHEN YOU STOP.",
        lines: ["...", "I AM A ROCK", "ROCK.", "CAN YOU SMELL IT", "*MOGS YOU*"],
    },
    {
        id: "maneki",
        role: "legend",
        name: "MANEKI",
        kind: "LUCKY CAT",
        price: 2_000_000,
        skill: "GOLDEN PAW",
        auto: true,
        cooldown: 0,
        doubleChance: 0.15,
        passive: { stat: "chest", per: 0.5, label: "CHEST CHANCE" },
        desc: "AUTO: EVERY BET WIN HAS A 15% CHANCE TO PAY DOUBLE. THE PAW NEVER STOPS WAVING.",
        lines: ["*WAVES*", "COME IN, COME IN", "FORTUNE FAVORS THE PAW", "MONEY CAT", "PAW-SITIVE VIBES ONLY"],
    },
    // The 67 duo. Owning both unlocks the SIX SEVEN skin.
    {
        id: "digit6",
        role: "legend",
        name: "SIX",
        kind: "NUMBER",
        price: 5_000_000,
        skill: "SIX SHOOTER",
        auto: true,
        cooldown: 0,
        every: 6,
        passive: { stat: "payout", per: 0.66, label: "SLOT PAYOUT" },
        desc: "AUTO: ON EVERY 6TH BET SPIN A DEAD ROLL HAS A 30% CHANCE TO BECOME A PAIR. OWN SIX AND SEVEN TOGETHER FOR A SECRET SKIN.",
        lines: ["SIX", "SIIIX", "6!", "WHERE IS SEVEN?", "6... 7?"],
    },
    {
        id: "digit7",
        role: "legend",
        name: "SEVEN",
        kind: "NUMBER",
        price: 5_000_000,
        skill: "SEVEN HEAVEN",
        auto: false,
        cooldown: 7 * MIN,
        sevenSpins: 7,
        passive: { stat: "chest", per: 0.77, label: "CHEST CHANCE" },
        desc: "TAP SKILL: YOUR NEXT 7 BET SPINS EACH HAVE A 2.5% CHANCE TO LAND 7-7-7 (NORMALLY 1 IN 8,000). RECHARGES IN 7 MIN. OWN SIX AND SEVEN TOGETHER FOR A SECRET SKIN.",
        lines: ["SEVEN", "SEVEEEN", "7!", "SIX? SIX!", "WHAT DOES IT MEAN? 7."],
    },
];

export const BURN = {
    tiers: [
        { name: "SPARK", at: 0, bonus: 0 },
        { name: "EMBER", at: 5000, bonus: 0.05 },
        { name: "FLAME", at: 15000, bonus: 0.1 },
        { name: "BLAZE", at: 40000, bonus: 0.15 },
        { name: "INFERNO", at: 100000, bonus: 0.2 },
        { name: "SUPERNOVA", at: 250000, bonus: 0.25 },
    ],
    gradeShare: { perfect: 1, good: 0.6, miss: 0.25 },
};

// `window` is how long you may pause between taps before the combo dies. It shrinks tier by tier,
// but never below ~0.42s (2-3 taps a second), so a high combo asks for steady spam, not superhuman speed.
const RAINBOW = ["y", "R", "r", "v", "B", "c", "G", "w"];
export const COMBO = {
    showAt: 5,
    minSad: 50,
    cosmicFrom: 8,
    cosmicPulseEvery: 25,
    tiers: [
        { at: 0, window: 900, name: "COMBO", colors: ["l", "S", "w"], glow: "l", intensity: 0 },
        { at: 50, window: 860, name: "WARM", colors: ["y", "R"], glow: "R", intensity: 0.15 },
        { at: 100, window: 820, name: "HOT", colors: ["R", "y", "r"], glow: "R", intensity: 0.3 },
        { at: 200, window: 780, name: "BLAZING", colors: ["R", "r", "y", "w"], glow: "r", intensity: 0.45 },
        { at: 350, window: 740, name: "INFERNO", colors: ["r", "R", "w"], glow: "r", intensity: 0.6 },
        { at: 500, window: 700, name: "PLASMA", colors: ["r", "v", "R"], glow: "v", intensity: 0.65 },
        { at: 800, window: 660, name: "NEBULA", colors: ["v", "B", "c"], glow: "v", intensity: 0.75, stars: true },
        { at: 1500, window: 620, name: "STARFALL", colors: ["v", "c", "w", "B"], glow: "c", intensity: 0.85, stars: true },
        { at: 2000, window: 580, name: "COSMIC", colors: RAINBOW, glow: "v", intensity: 1, stars: true },
        { at: 3500, window: 540, name: "SUPERNOVA", colors: ["w", "y", "R", "c"], glow: "w", intensity: 1, stars: true },
        { at: 5000, window: 480, name: "SINGULARITY", colors: ["v", "k", "c", "w"], glow: "v", intensity: 1, stars: true, special: "singularity" },
        { at: 10000, window: 420, name: "BIG BANG", colors: RAINBOW, glow: "w", intensity: 1, stars: true, special: "bigbang" },
    ],
};

// Everything you can hold. Brews carry a `use` reward, applied through luck.applyReward.
export const ITEMS = {
    stone: { name: "STONE", rarity: "common", from: "MINE TAPS" },
    iron: { name: "IRON", rarity: "rare", from: "MINE TAPS" },
    crystal: { name: "CRYSTAL", rarity: "epic", from: "LUCKY TAPS" },
    shard: { name: "LUCK SHARD", rarity: "common", from: "SLOT WINS" },
    stardust: { name: "STARDUST", rarity: "epic", from: "COSMIC STARS" },
    wing: { name: "BAT WING", rarity: "rare", from: "GOLDEN BATS" },
    herb: { name: "HERB", rarity: "common", from: "GARDEN" },
    glowcap: { name: "GLOWCAP", rarity: "rare", from: "GARDEN" },
    meteor: { name: "METEORITE", rarity: "legendary", from: "THE VAULT" },
    seed: { name: "SEED", rarity: "common", from: "EVERY CHEST, HARVESTS" },
    goldseed: { name: "GOLD SEED", rarity: "epic", from: "LUCKY CHESTS, LUCKY HARVESTS" },
    goldfruit: { name: "GOLD FRUIT", rarity: "legendary", from: "GOLD SEEDS" },
    relicDust: { name: "RELIC DUST", rarity: "epic", from: "SALVAGED RELICS, THE VAULT" },
    // Junk. Mostly it just piles up and looks good in the bag; some of it brews the combo brews.
    pebble: { name: "PEBBLE", rarity: "common", from: "MINE TAPS", junk: true },
    nail: { name: "RUSTY NAIL", rarity: "common", from: "MINE TAPS", junk: true },
    dustbunny: { name: "DUST BUNNY", rarity: "common", from: "MINE TAPS", junk: true },
    spoon: { name: "BENT SPOON", rarity: "rare", from: "MINE TAPS", junk: true },
    bottlecap: { name: "BOTTLE CAP", rarity: "common", from: "SLOT WINS", junk: true },
    ticket: { name: "TICKET STUB", rarity: "common", from: "SLOT WINS", junk: true },
    button: { name: "LOST BUTTON", rarity: "common", from: "SLOT WINS", junk: true },
    duck: { name: "RUBBER DUCK", rarity: "epic", from: "SLOT WINS", junk: true },
    marble: { name: "GLASS MARBLE", rarity: "rare", from: "LUCKY TAPS", junk: true },
    oldcoin: { name: "ANCIENT COIN", rarity: "epic", from: "LUCKY TAPS", junk: true },
    tooth: { name: "GOLD TOOTH", rarity: "legendary", from: "LUCKY TAPS", junk: true },
    feather: { name: "GOLD FEATHER", rarity: "rare", from: "GOLDEN BATS", junk: true },
    key: { name: "MYSTERY KEY", rarity: "rare", from: "GOLDEN BATS", junk: true },
    horseshoe: { name: "HORSESHOE", rarity: "legendary", from: "COSMIC STARS", junk: true },
    rushBrew: { name: "RUSH BREW", rarity: "rare", from: "FORGE", use: { type: "goldRush", seconds: 120 }, effect: "GOLD RUSH 120S" },
    fireBrew: { name: "FIRE BREW", rarity: "rare", from: "FORGE", use: { type: "heat", amount: 5 }, effect: "MAX HEAT" },
    hotBrew: { name: "HOT BREW", rarity: "epic", from: "FORGE", use: { type: "hotMachine", spins: 10 }, effect: "10 HOT SPINS" },
    luckBrew: { name: "LUCK BREW", rarity: "legendary", from: "FORGE", use: { type: "chest", boost: 100, n: 2 }, effect: "2 LEGENDARY CHESTS" },
    midasBrew: { name: "MIDAS BREW", rarity: "legendary", from: "FORGE", use: { type: "timed", key: "midas", seconds: 600, label: "MIDAS: SLOT WINS x2" }, effect: "10 MIN: SLOT WINS x2" },
    starBrew: { name: "STARLIGHT ELIXIR", rarity: "epic", from: "FORGE", use: { type: "spins", key: "starSpins", n: 20, label: "STARLIGHT: STAR ODDS x5" }, effect: "20 SPINS: STAR ODDS x5" },
    titanBrew: { name: "TITAN TONIC", rarity: "epic", from: "FORGE", use: { type: "timed", key: "titan", seconds: 900, label: "TITAN: TAPS x5 + AUTO TAP" }, effect: "15 MIN: TAPS x5 + AUTO TAP" },
    breakerBrew: { name: "VAULT BREAKER", rarity: "epic", from: "FORGE", use: { type: "spins", key: "breakerSpins", n: 50, label: "BREAKER: VAULT DAMAGE x3" }, effect: "50 SPINS: VAULT DAMAGE x3" },
    phoenixBrew: { name: "PHOENIX DRAUGHT", rarity: "legendary", from: "FORGE", use: { type: "timed", key: "phoenix", seconds: 60, label: "PHOENIX: UNBREAKABLE COMBO" }, effect: "60S: COMBO CAN'T BREAK, HEAT MAXED" },
    // Combo brews: for a spam session. Brewed from junk, and secret until every ingredient has been found once.
    voidBrew: { name: "BOTTOMLESS FLASK", rarity: "epic", from: "FORGE", use: { type: "timed", key: "bottomless", seconds: 60, label: "BOTTOMLESS: THE CART HAS NO LIMIT" }, effect: "60S: THE CART HAS NO LIMIT" },
    hypeBrew: { name: "HYPE JUICE", rarity: "rare", from: "FORGE", use: { type: "timed", key: "hype", seconds: 120, label: "HYPE: SELLING PAYS x2" }, effect: "120S: SELLING ORE PAYS x2 COIN" },
    surgeBrew: { name: "ORE SURGE", rarity: "rare", from: "FORGE", use: { type: "timed", key: "surge", seconds: 90, label: "SURGE: TAPS DIG x2 ORE" }, effect: "90S: EVERY TAP DIGS x2 ORE" },
};

// Chance per event that each item drops while you play. Common and rare finds are the easy ones: they drop half
// as often as they used to; epic and legendary finds keep their odds.
export const DROPS = {
    tap: [
        { id: "stone", chance: 0.03 },
        { id: "iron", chance: 0.006 },
        { id: "pebble", chance: 0.01 },
        { id: "nail", chance: 0.005 },
        { id: "dustbunny", chance: 0.004 },
        { id: "spoon", chance: 0.0015 },
    ],
    luckyTap: [
        { id: "crystal", chance: 0.25 },
        { id: "marble", chance: 0.06 },
        { id: "oldcoin", chance: 0.03 },
        { id: "tooth", chance: 0.005 },
    ],
    win: [
        { id: "shard", chance: 0.175 },
        { id: "bottlecap", chance: 0.04 },
        { id: "ticket", chance: 0.025 },
        { id: "button", chance: 0.015 },
        { id: "duck", chance: 0.005 },
    ],
    star: [
        { id: "stardust", chance: 1 },
        { id: "horseshoe", chance: 0.05 },
    ],
    bat: [
        { id: "wing", chance: 0.5 },
        { id: "feather", chance: 0.125 },
        { id: "key", chance: 0.1 },
    ],
};

// Every bonus source (gear, sets, pets, VIP, relics) adds into one of a few stats. Past `knee` a stat gives
// diminishing returns and can never pass `cap`, so stacking everything stays strong without breaking the game.
// `payout` also takes the burn bonus. Stats not listed are uncapped.
export const STAT_CAPS = {
    payout: { knee: 0.25, cap: 0.5 },
    zone: { knee: 0.25, cap: 0.5 },
    chest: { knee: 1, cap: 2 },
    sell: { knee: 0.6, cap: 1.2 },
    drill: { knee: 1, cap: 3 },
    yield: { knee: 1, cap: 2.5 },
    grow: { knee: 0.5, cap: 0.75 },
    petCd: { knee: 0.3, cap: 0.6 },
};

// Junk can be scrapped for coins: `per` x the chest coin unit (about your usual bet) per piece, by rarity.
export const SCRAP = { common: 0.2, rare: 0.8, epic: 3, legendary: 12 };

// Permanent upgrades. Each level adds `per` to `stat`; costs grow by GEAR_GROWTH per level.
export const GEAR_MAX = 5;
export const GEAR_GROWTH = 1.7;
export const GEAR = [
    { id: "grip", name: "STONE GRIP", icon: "i-pick", stat: "tap", per: 1, label: "ORE PER TAP", cost: { stone: 8 } },
    { id: "bit", name: "IRON BIT", icon: "i-drill", stat: "drill", per: 0.1, pct: true, label: "DRILL SPEED", cost: { iron: 4, stone: 6 } },
    { id: "pockets", name: "BIG POCKETS", icon: "i-cart", stat: "cart", per: 0.15, pct: true, label: "CART SIZE", cost: { stone: 10, herb: 4 } },
    { id: "ring", name: "MERCHANT RING", icon: "coin", stat: "sell", per: 0.06, pct: true, label: "ORE PRICE", cost: { iron: 4, crystal: 1 } },
    { id: "charm", name: "LUCKY CHARM", icon: "clover", stat: "chest", per: 0.15, pct: true, label: "CHEST CHANCE", cost: { shard: 8, wing: 1 } },
    { id: "lens", name: "STAR LENS", icon: "gem", stat: "zone", per: 0.05, pct: true, label: "TIMING ZONE", cost: { crystal: 2, stardust: 1 } },
    { id: "compass", name: "SEED POUCH", icon: "seed", stat: "yield", per: 0.1, pct: true, label: "GARDEN YIELD", cost: { herb: 8, iron: 3 } },
    { id: "can", name: "WATERING CAN", icon: "herb", stat: "grow", per: 0.08, pct: true, label: "GROW SPEED", cost: { iron: 3, herb: 6 } },
    { id: "collar", name: "PET COLLAR", icon: "heart", stat: "petCd", per: 0.06, pct: true, label: "PET RECHARGE", cost: { wing: 2, glowcap: 3 } },
    { id: "crown", name: "METEOR CROWN", icon: "meteor", stat: "payout", per: 0.04, pct: true, label: "SLOT PAYOUT", cost: { meteor: 1, crystal: 3, goldfruit: 1 } },
];

// Past LV5 gear ascends: 1-5 stars. Each star adds STAR_MULT x the piece's normal step, and costs a fortune.
export const GEAR_STARS = 5;
export const STAR_MULT = 2;
export const STAR_COST = [
    { coins: 5e6, gems: 5, meteor: 1, stardust: 3, relicDust: 2 },
    { coins: 25e6, gems: 10, meteor: 2, stardust: 5, relicDust: 5 },
    { coins: 1e8, gems: 20, meteor: 3, goldfruit: 1, relicDust: 10 },
    { coins: 3e8, gems: 35, meteor: 5, goldfruit: 2, relicDust: 20 },
    { coins: 1e9, gems: 50, meteor: 8, goldfruit: 3, relicDust: 35 },
];
// Every craft costs coins on top of its materials: gear LV1-5 pays `gear` x GEAR_GROWTH^level (stars have their
// own coin cost in STAR_COST), a brew pays by the rarity of what it makes.
export const CRAFT_FEE = {
    gear: 200,
    brew: { common: 100, rare: 400, epic: 2000, legendary: 10_000 },
};

// The chance each star attempt (1st .. 5th star) succeeds. A failed attempt still spends its cost and cracks one
// star off the piece (never below LV5: a failed first star just costs).
export const STAR_CHANCE = [0.8, 0.65, 0.45, 0.3, 0.15];
// Every piece of a set at 3 stars or more switches on the set bonus.
export const SET_STARS = 3;
export const GEAR_SETS = [
    { id: "digger", name: "DIGGER SET", gear: ["grip", "bit", "pockets", "ring"], stat: "sell", per: 0.5, label: "ORE PRICE" },
    { id: "roller", name: "HIGH ROLLER SET", gear: ["charm", "lens", "crown"], stat: "payout", per: 0.25, label: "SLOT PAYOUT" },
    { id: "keeper", name: "KEEPER SET", gear: ["compass", "can", "collar"], stat: "yield", per: 0.5, label: "GARDEN YIELD" },
];

export const BREWS = [
    { id: "rushBrew", cost: { herb: 3, iron: 1 } },
    { id: "fireBrew", cost: { glowcap: 1, herb: 3 } },
    { id: "hotBrew", cost: { glowcap: 2, shard: 4 } },
    { id: "luckBrew", cost: { goldfruit: 1, stardust: 1 } },
    { id: "midasBrew", cost: { goldfruit: 1, meteor: 1, relicDust: 2 } },
    { id: "starBrew", cost: { stardust: 5, crystal: 3 } },
    { id: "titanBrew", cost: { glowcap: 4, iron: 5, meteor: 1 } },
    { id: "breakerBrew", cost: { relicDust: 5, crystal: 2 } },
    { id: "phoenixBrew", cost: { goldfruit: 1, glowcap: 5 } },
    // `combo` brews sit under their own heading and stay secret until each ingredient has been found once.
    { id: "voidBrew", cost: { pebble: 6, nail: 4, spoon: 1, iron: 2 }, combo: true },
    { id: "hypeBrew", cost: { bottlecap: 5, ticket: 4, button: 3, oldcoin: 1 }, combo: true },
    { id: "surgeBrew", cost: { dustbunny: 4, marble: 2, herb: 4, stone: 6 }, combo: true },
];

// What the big brews do while they run.
export const BREW_FX = { midasMult: 2, titanMult: 5, titanTapsPerSec: 2, starMult: 5, breakerMult: 3, hypeMult: 2, surgeMult: 2 };

// The buff row, in order. `key` lives in state.buffs: a timestamp for timers, a count otherwise.
export const BUFF_CHIPS = [
    { key: "goldRush", kind: "timer", cls: "rush", icon: "ore", title: "GOLD RUSH: MINE x3" },
    { key: "hotSpins", kind: "count", cls: "hot", icon: "flame", title: "HOT MACHINE SPINS LEFT" },
    { key: "rockSpins", kind: "count", cls: "rock", icon: "rock", title: "DWAYNE: PERFECT SPINS LEFT" },
    { key: "loadedSpins", kind: "count", cls: "dice", icon: "dice", title: "DICEY: LOADED SPINS LEFT" },
    { key: "sevenSpins", kind: "count", cls: "seven", icon: "digit7", title: "SEVEN: 2.5% 7-7-7 CHANCE, SPINS LEFT" },
    { key: "midas", kind: "timer", cls: "brew", icon: "midasBrew", scale: 1, color: "y", title: "MIDAS: SLOT WINS x2" },
    { key: "titan", kind: "timer", cls: "brew", icon: "titanBrew", scale: 1, color: "l", title: "TITAN: TAPS x5 + AUTO TAP" },
    { key: "phoenix", kind: "timer", cls: "brew", icon: "phoenixBrew", scale: 1, color: "v", title: "PHOENIX: COMBO CAN'T BREAK" },
    { key: "bottomless", kind: "timer", cls: "brew", icon: "voidBrew", scale: 1, color: "v", title: "BOTTOMLESS: THE CART HAS NO LIMIT" },
    { key: "hype", kind: "timer", cls: "brew", icon: "hypeBrew", scale: 1, color: "P", title: "HYPE: SELLING PAYS x2" },
    { key: "surge", kind: "timer", cls: "brew", icon: "surgeBrew", scale: 1, color: "O", title: "SURGE: TAPS DIG x2 ORE" },
    { key: "freeze", kind: "timer", cls: "brew", icon: "frosty", scale: 1, color: "c", title: "BRAIN FREEZE: THE PICK CAN'T OVERHEAT" },
    { key: "starSpins", kind: "count", cls: "brew", icon: "starBrew", scale: 1, color: "c", title: "STARLIGHT: STAR ODDS x5" },
    { key: "breakerSpins", kind: "count", cls: "brew", icon: "breakerBrew", scale: 1, color: "B", title: "VAULT BREAKER: DAMAGE x3" },
];

// The garden runs on timestamps: each planting rolls its grow time (minutes, between the two numbers) when it goes
// in, and its harvest from a stored seed, so reopening the popup always shows the same plot. A yield line is
// [item, amount, chance]; GARDEN YIELD multiplies the amount (the fraction left over is a chance at one more).
export const FARM = {
    plots: 6,
    // Coins to open each plot, in order: the first pot is free, the rest cost a little more each time (about
    // 10-20 minutes of play apiece when the farm opens, a light goal later).
    plotCost: [0, 300, 800, 2000, 5000, 12000],
    // A plant shows `stages` growth stages, one per equal share of its grow time; before `sproutAt` of it the
    // pot is still just watered soil.
    stages: 5,
    sproutAt: 0.02,
    crops: {
        seed: { minutes: [1, 30], yields: [["herb", 3, 1], ["glowcap", 1, 0.35], ["seed", 1, 0.5], ["goldseed", 1, 0.03]] },
        goldseed: { minutes: [45, 120], yields: [["goldfruit", 1, 1], ["goldseed", 1, 0.15]] },
    },
};

// Diamonds: the rare currency for cosmetics. They only drip in from big moments.
export const GEMS = {
    luckyTapChance: 0.03, // of lucky mine taps
    tiers: { jackpot: 3, cosmic: 10 },
    levelEvery: 5,
    perMilestone: 2,
};

// Mine skins are pure flex: they change the scene, never the numbers.
export const SKINS = [
    { id: "miner", name: "THE MINER", icon: "miner", price: 0, desc: "THE CLASSIC. PICK, ROCK, CART. HONEST WORK." },
    {
        id: "office",
        name: "9 TO 5",
        icon: "clerk",
        price: 20,
        desc: "SMASH THE KEYBOARD LEFT, RIGHT, LEFT. EVERY COIN FLIES INTO THE BOSS'S POCKET. ZERO STATS, MAXIMUM FLEX.",
    },
    {
        id: "casino",
        name: "PLAY ITSELF",
        icon: "gambler",
        price: 30,
        desc: "IT'S YOU. SLAMMING THE SPIN BUTTON, HEADBUTTING IT WHEN YOU SPAM. EVERY COIN FLIES OVER YOUR HEAD INTO THE CASINO OWNER'S POCKET. TOO REAL.",
    },
    {
        id: "sixseven",
        name: "SIX SEVEN",
        icon: "kid",
        price: 0,
        requires: ["digit6", "digit7"],
        desc: "CLASSIC BRAINROT. SEESAW KID DOES THE PALMS-UP SEESAW ON A NIGHT COURT, THE SCOREBOARD IS STUCK ON 67, SIX AND SEVEN RIDE A SEESAW FULL OF COINS. EVERY 67TH TAP: SIX SEVEN! WHAT DOES IT MEAN? 6-7. NOT FOR SALE: OWN BOTH NUMBERS.",
    },
];

// VIP: permanent tiers earned by total coins bet. Each tier adds bonuses (bets are capped by level, not VIP).
export const VIP = [
    { name: "GUEST", at: 0, color: "l", bonus: {} },
    { name: "BRONZE", at: 1e7, color: "O", bonus: { payout: 0.05 } },
    { name: "SILVER", at: 1e8, color: "w", bonus: { payout: 0.1 } },
    { name: "GOLD", at: 1e9, color: "y", bonus: { payout: 0.2, chest: 0.25 } },
    { name: "PLATINUM", at: 1e10, color: "c", bonus: { payout: 0.35, chest: 0.35 } },
    { name: "DIAMOND", at: 1e11, color: "B", bonus: { payout: 0.5, chest: 0.5 } },
    { name: "BLACK CARD", at: 1e12, color: "v", bonus: { payout: 1, chest: 0.75, sell: 0.5 } },
];

// Relics: rare loot with rolled stats. Worn in RELICS.slots, rerolled with diamonds, salvaged into dust.
export const RELICS = {
    slots: 3,
    cap: 20,
    rarities: [
        { id: "rare", weight: 60, stats: 1, mult: 1, dust: 1, reroll: 2 },
        { id: "epic", weight: 30, stats: 2, mult: 1.4, dust: 3, reroll: 4 },
        { id: "legendary", weight: 10, stats: 3, mult: 2, dust: 8, reroll: 8 },
    ],
    stats: [
        { stat: "payout", min: 0.04, max: 0.12, label: "SLOT PAYOUT", adj: "GREEDY" },
        { stat: "chest", min: 0.1, max: 0.3, label: "CHEST CHANCE", adj: "LUCKY" },
        { stat: "sell", min: 0.1, max: 0.3, label: "ORE PRICE", adj: "MERCHANT'S" },
        { stat: "drill", min: 0.1, max: 0.4, label: "DRILL SPEED", adj: "THUNDER" },
        { stat: "zone", min: 0.04, max: 0.12, label: "TIMING ZONE", adj: "STEADY" },
        { stat: "yield", min: 0.1, max: 0.3, label: "GARDEN YIELD", adj: "HARVEST" },
        { stat: "grow", min: 0.1, max: 0.25, label: "GROW SPEED", adj: "BLOOMING" },
        { stat: "petCd", min: 0.05, max: 0.15, label: "PET RECHARGE", adj: "LOYAL" },
    ],
    nouns: ["IDOL", "AMULET", "SKULL", "SIGIL", "TALISMAN", "CHALICE", "EYE", "CROWN"],
};

// The Vault: one per day. Spins and mine taps chip its HP; each one cracked makes the next tougher and richer.
export const VAULT = {
    baseHp: 50_000,
    growth: 2.2,
    spinGrade: { perfect: 3, good: 2, miss: 1 },
};
