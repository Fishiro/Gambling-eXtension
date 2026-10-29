// Every sound in the game, synthesized with Web Audio (no files). Sounds play through one of a few category buses
// (BUSES), each with its own volume in Settings, into a master gain and a limiter.
//
// Design rules: every event has its own signature; streaks climb in pitch (heat, combo, bets, big sales), rarer
// moments sound longer and fuller, and anything that can be spammed is throttled.

let audio = null;
let master = null;
let volume = 1;
let enabled = true;

// Category buses, in the order Settings lists them.
export const BUSES = [
    { id: "ui", name: "BUTTONS" },
    { id: "slot", name: "SLOT" },
    { id: "mine", name: "MINE" },
    { id: "loot", name: "LOOT" },
    { id: "world", name: "FARM, PETS, FORGE" },
];
const buses = {};
const mix = Object.fromEntries(BUSES.map((b) => [b.id, 1]));
// The bus the sound being scheduled right now plays on (set by `on` below; scheduling is synchronous).
let bus = "ui";

export const setSound = (on) => {
    enabled = on;
    if (!on) drone.stop();
};

export const setVolume = (v) => {
    volume = v;
    if (master) master.gain.value = volume;
};

export const setMix = (id, v) => {
    mix[id] = v;
    if (buses[id]) buses[id].gain.value = v;
};

function context() {
    if (!audio) {
        audio = new AudioContext();
        const limiter = audio.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.ratio.value = 12;
        master = audio.createGain();
        master.gain.value = volume;
        master.connect(limiter).connect(audio.destination);
        for (const { id } of BUSES) {
            buses[id] = audio.createGain();
            buses[id].gain.value = mix[id];
            buses[id].connect(master);
        }
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
}

const out = () => buses[bus] ?? master;

// ---- building blocks ----

function tone(freq, dur, { type = "square", vol = 0.04, at = 0, slide = 0, attack = 0 } = {}) {
    if (!enabled) return;
    const a = context();
    const t = a.currentTime + at;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    if (attack) {
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(vol, t + attack);
    } else gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out());
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

// Filtered noise: `freq` and `filter` shape it (lowpass thumps, highpass hiss, bandpass whooshes), `sweep` moves
// the filter over its life.
function noise(dur, vol = 0.05, at = 0, { filter = "lowpass", freq = 900, sweep = 0, q = 1 } = {}) {
    if (!enabled) return;
    const a = context();
    const t = a.currentTime + at;
    const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = a.createBufferSource();
    const f = a.createBiquadFilter();
    const gain = a.createGain();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
    gain.gain.value = vol;
    src.buffer = buffer;
    src.connect(f).connect(gain).connect(out());
    src.start(t);
}

const arpeggio = (notes, step, opts = {}) => notes.forEach((f, i) => tone(f, step * 1.4, { ...opts, at: (opts.at ?? 0) + i * step }));
const chord = (notes, dur, opts = {}) => notes.forEach((f) => tone(f, dur, opts));
// Semitones above A3.
const note = (semi) => 220 * 2 ** (semi / 12);
const PENTA = [0, 2, 4, 7, 9];
const penta = (step) => PENTA[step % 5] + 12 * Math.floor(step / 5);

// Wrap a sound so it plays on a bus, at most once every `gap` ms.
function on(id, fn, gap = 0) {
    let last = 0;
    return (...args) => {
        if (gap) {
            const now = performance.now();
            if (now - last < gap) return;
            last = now;
        }
        const prev = bus;
        bus = id;
        try {
            fn(...args);
        } finally {
            bus = prev;
        }
    };
}

// ---- the sounds, by bus ----

const ui = {
    click: () => tone(880, 0.03, { vol: 0.02 }),
    // Spend/earn buttons: a bright double clink.
    clink: () => {
        tone(2093, 0.06, { type: "triangle", vol: 0.04 });
        tone(2637, 0.08, { type: "triangle", vol: 0.035, at: 0.04 });
    },
    // Pressing a disabled button.
    thud: () => {
        tone(110, 0.09, { type: "triangle", slide: -50, vol: 0.07 });
        noise(0.05, 0.08);
    },
    denied: () => {
        tone(165, 0.08, { type: "sawtooth", vol: 0.025 });
        tone(110, 0.12, { type: "sawtooth", vol: 0.025, at: 0.06 });
    },
    // Each dock tab has its own voice: SLOT a coin chime, MINE a pick ping, FARM a bird chirp, BAG a zip.
    tab: (name) => {
        const voices = {
            slot: () => arpeggio([1319, 1760], 0.035, { type: "triangle", vol: 0.03 }),
            mine: () => {
                tone(1568, 0.05, { type: "triangle", vol: 0.035 });
                noise(0.03, 0.06, 0, { filter: "highpass", freq: 3000 });
            },
            farm: () => {
                tone(2400, 0.06, { type: "sine", slide: 900, vol: 0.03 });
                tone(2800, 0.05, { type: "sine", slide: 700, vol: 0.025, at: 0.07 });
            },
            bag: () => noise(0.09, 0.07, 0, { filter: "bandpass", freq: 1500, sweep: 2500, q: 3 }),
        };
        (voices[name] ?? (() => tone(1200, 0.015, { slide: -500, vol: 0.03 })))();
    },
    // Segmented buttons, bag views, menu pages.
    nav: () => {
        tone(1200, 0.015, { slide: -500, vol: 0.03 });
        noise(0.012, 0.06);
    },
    menuOpen: () => noise(0.16, 0.06, 0, { filter: "bandpass", freq: 400, sweep: 2400, q: 2 }),
    menuClose: () => noise(0.14, 0.06, 0, { filter: "bandpass", freq: 2600, sweep: -2200, q: 2 }),
    toggle: (onState) => (onState ? arpeggio([660, 990], 0.04, { vol: 0.025 }) : arpeggio([660, 440], 0.04, { vol: 0.025 })),
    // A bet step: the bigger the bet against the cap (0..1), the higher the blip.
    bet: (delta, ratio) => tone(note(12 + Math.round(ratio * 24)), 0.05, { type: "triangle", vol: 0.04, slide: delta > 0 ? 120 : -120 }),
    betSet: () => arpeggio([784, 1175], 0.04, { type: "triangle", vol: 0.035 }),
    modal: () => {
        noise(0.1, 0.05, 0, { filter: "bandpass", freq: 600, sweep: 1800, q: 2 });
        arpeggio([659, 880, 1109, 1319], 0.05, { vol: 0.03, at: 0.05 });
    },
    confirm: () => arpeggio([988, 1319], 0.05, { vol: 0.03 }),
    welcome: () => arpeggio([523, 659, 784, 1047, 784, 1047], 0.08, { type: "triangle", vol: 0.04 }),
    talk: () => tone(500 + Math.random() * 300, 0.03, { vol: 0.012 }),
    trophy: () => arpeggio([784, 988, 1175, 1568, 1175, 1568], 0.06, { type: "triangle", vol: 0.04 }),
    levelUp: () => {
        arpeggio([523, 523, 784, 784, 1047, 1319, 1568], 0.09, { vol: 0.045 });
        chord([1047, 1319, 1568], 0.8, { type: "triangle", vol: 0.025, at: 0.63 });
    },
    collapse: () => {
        noise(1.4, 0.14);
        tone(80, 1.6, { type: "sawtooth", slide: -50, vol: 0.04 });
        [[392, 0.5], [370, 0.85], [349, 1.2]].forEach(([f, at]) => tone(f, 0.32, { type: "triangle", vol: 0.05, at }));
        tone(330, 1.4, { type: "triangle", slide: -200, vol: 0.05, at: 1.55 });
    },
};

let lastTick = 0;
let lastClack = 0;

const slot = {
    // The lever: a whoosh that rises higher the hotter the machine is.
    spin: (heat = 0) => {
        tone(196 + heat * 30, 0.16, { slide: 300 + heat * 80, vol: 0.03 });
        noise(0.18, 0.05, 0, { filter: "bandpass", freq: 500, sweep: 1500 + heat * 300, q: 1.5 });
    },
    freeSpin: () => arpeggio([1047, 1319, 1568, 2093], 0.04, { type: "triangle", vol: 0.03 }),
    reel: (i) => {
        tone(150 + i * 45, 0.07, { type: "triangle", vol: 0.09 });
        noise(0.04, 0.08, 0, { freq: 500 });
    },
    // Reel clack: a "tit" beep plus a snap per symbol, louder and lower as the reel slows.
    clack: (i, speed) => {
        const now = performance.now();
        if (now - lastClack < 22) return;
        lastClack = now;
        const slow = 1 - speed;
        tone(2200 - slow * 700 + i * 120, 0.022, { vol: 0.04 + slow * 0.04 });
        tone(900 - slow * 300, 0.03, { slide: -600, vol: 0.05 + slow * 0.05 });
        noise(0.02, 0.16 + slow * 0.14);
    },
    // Counting a win up.
    tick: () => {
        const now = performance.now();
        if (now - lastTick < 45) return;
        lastTick = now;
        tone(1400, 0.02, { vol: 0.015 });
    },
    perfect: () => {
        arpeggio([988, 1319, 1760], 0.05, { vol: 0.035 });
        tone(3520, 0.2, { type: "sine", vol: 0.015, at: 0.12 });
    },
    good: () => arpeggio([784, 988], 0.05, { vol: 0.03 }),
    miss: () => tone(170, 0.09, { type: "triangle", vol: 0.05 }),
    // A flame lights: each pip a step up the scale, the fifth a little fanfare.
    heatUp: (heat) => {
        tone(note(penta(heat + 4)), 0.09, { type: "triangle", vol: 0.04 });
        noise(0.08, 0.04, 0, { filter: "highpass", freq: 2000, sweep: 3000 });
        if (heat >= 5) arpeggio([note(24), note(28), note(31)], 0.05, { vol: 0.03, at: 0.08 });
    },
    // The flames go out.
    heatLost: () => {
        noise(0.3, 0.06, 0, { filter: "highpass", freq: 4000, sweep: -3500 });
        tone(330, 0.25, { type: "triangle", slide: -200, vol: 0.03 });
    },
    burnTier: () => {
        noise(0.4, 0.09, 0, { filter: "lowpass", freq: 200, sweep: 2500 });
        arpeggio([392, 523, 659, 784, 1047], 0.05, { vol: 0.035, at: 0.15 });
    },
    // Two matching reels: hold your breath.
    tease: () => {
        tone(392, 0.5, { type: "triangle", slide: 120, vol: 0.025, attack: 0.15 });
        tone(588, 0.5, { type: "triangle", slide: 180, vol: 0.015, attack: 0.15 });
    },
    lucky: () => {
        arpeggio([1319, 1760, 2349, 2794], 0.04, { vol: 0.03 });
        noise(0.25, 0.04, 0.05, { filter: "highpass", freq: 5000 });
    },
    win: () => arpeggio([523, 659, 784], 0.07, { vol: 0.035 }),
    big: () => {
        arpeggio([523, 659, 784, 1047, 784, 1047, 1319], 0.07, { vol: 0.04 });
        chord([523, 659, 784], 0.5, { type: "triangle", vol: 0.02, at: 0.5 });
    },
    mega: () => {
        tone(98, 0.5, { type: "sawtooth", slide: 60, vol: 0.04 });
        arpeggio([523, 659, 784, 1047, 1319, 1047, 1319, 1568], 0.065, { vol: 0.042 });
        chord([784, 988, 1175, 1568], 0.7, { type: "triangle", vol: 0.022, at: 0.55 });
        noise(0.4, 0.05, 0.5, { filter: "highpass", freq: 4000 });
    },
    jackpot: () => {
        tone(65, 0.8, { type: "sawtooth", slide: 65, vol: 0.05 });
        arpeggio([523, 659, 784, 1047, 1319, 1047, 1319, 1568, 2093], 0.08, { vol: 0.045 });
        arpeggio([2093, 2637, 3136, 2637, 3136, 4186], 0.05, { type: "triangle", vol: 0.02, at: 0.75 });
        chord([523, 784, 1047, 1319], 1.2, { type: "triangle", vol: 0.025, at: 0.75 });
    },
    lose: () => tone(220, 0.2, { type: "triangle", slide: -90, vol: 0.05 }),
    near: () => arpeggio([392, 370], 0.1, { type: "triangle", vol: 0.05 }),
    star: () => {
        arpeggio([1568, 2093, 2637], 0.05, { type: "sine", vol: 0.03 });
        noise(0.3, 0.03, 0, { filter: "highpass", freq: 6000 });
    },
    doubleStar: () => {
        arpeggio([1047, 1319, 1568, 2093, 2637, 3136], 0.05, { type: "sine", vol: 0.035 });
        chord([1047, 1568, 2093], 0.6, { type: "triangle", vol: 0.02, at: 0.3 });
        noise(0.5, 0.04, 0.1, { filter: "highpass", freq: 5000 });
    },
    sevenHeaven: () => {
        [0, 0.12, 0.24].forEach((at) => tone(note(19), 0.1, { vol: 0.04, at }));
        arpeggio([note(19), note(23), note(26), note(31)], 0.07, { vol: 0.04, at: 0.4 });
    },
    cosmicBuild: () => {
        tone(110, 3.6, { type: "sawtooth", slide: 880, vol: 0.025 });
        tone(165, 3.6, { type: "triangle", slide: 1320, vol: 0.03 });
        arpeggio([262, 330, 392, 523, 659, 784, 1047, 1319], 0.42, { type: "triangle", vol: 0.03 });
    },
    cosmic: () => {
        arpeggio([523, 659, 784, 1047, 1319, 1568, 2093, 1568, 2093, 2637], 0.07, { vol: 0.045 });
        [523, 659, 784, 1047].forEach((f) => tone(f, 1.6, { type: "triangle", at: 0.75, vol: 0.03 }));
        noise(0.6, 0.08, 0.7);
    },
    autoOn: () => arpeggio([392, 523, 659, 784], 0.035, { type: "triangle", vol: 0.03 }),
    autoOff: () => arpeggio([784, 659, 523, 392], 0.035, { type: "triangle", vol: 0.03 }),
    broke: () => {
        [[392, 0], [370, 0.18], [349, 0.36]].forEach(([f, at]) => tone(f, 0.18, { type: "triangle", vol: 0.04, at }));
        tone(330, 0.6, { type: "triangle", slide: -150, vol: 0.04, at: 0.54 });
    },
    sixSeven: () => {
        tone(60, 0.35, { type: "sine", slide: -25, vol: 0.12 });
        noise(0.06, 0.12);
        tone(620, 0.14, { slide: -120, vol: 0.05, at: 0.04 });
        noise(0.05, 0.1, 0.24);
        tone(560, 0.1, { slide: -60, vol: 0.05, at: 0.28 });
        tone(420, 0.22, { slide: -90, vol: 0.05, at: 0.4 });
    },
};

const mine = {
    // A pick hit: a rock thud plus a ping that varies a little each swing.
    mine: () => {
        noise(0.08, 0.12);
        tone(110, 0.06, { vol: 0.03 });
        tone(1200 + Math.random() * 500, 0.03, { type: "triangle", vol: 0.012 });
    },
    // A lucky tap: a crystal rings out.
    crystal: () => {
        arpeggio([1760, 2637, 3520], 0.035, { type: "sine", vol: 0.035 });
        tone(5274, 0.4, { type: "sine", vol: 0.01, at: 0.1 });
    },
    sizzle: () => noise(0.12, 0.05, 0, { filter: "highpass", freq: 5000, sweep: -2000 }),
    ice: () => tone(3000 + Math.random() * 800, 0.05, { type: "sine", vol: 0.02 }),
    cartFull: () => {
        tone(90, 0.12, { type: "square", vol: 0.04 });
        noise(0.08, 0.1, 0, { freq: 300 });
        tone(140, 0.1, { type: "square", vol: 0.03, at: 0.08 });
    },
    // Ka-ching: more coins jingle the fuller the cart was (share 0..1+).
    sell: (share = 0.5) => {
        noise(0.05, 0.08, 0, { filter: "highpass", freq: 2500 });
        tone(1568, 0.08, { type: "triangle", vol: 0.04, at: 0.03 });
        const coins = 2 + Math.min(8, Math.round(share * 6));
        for (let i = 0; i < coins; i++) tone(2093 + Math.random() * 1500, 0.06, { type: "triangle", vol: 0.02, at: 0.08 + i * 0.045 });
        if (share >= 1) chord([1047, 1319, 1568], 0.35, { type: "triangle", vol: 0.02, at: 0.1 + coins * 0.045 });
    },
    // Each upgrade has its own clang: the pick rings high, the drill whirs, the cart rumbles.
    mineUpgrade: (kind) => {
        const voices = {
            pick: () => arpeggio([784, 1047, 1568], 0.05, { type: "triangle", vol: 0.04 }),
            drill: () => {
                tone(180, 0.35, { type: "sawtooth", slide: 400, vol: 0.025 });
                arpeggio([523, 784, 1047], 0.06, { vol: 0.03, at: 0.2 });
            },
            cart: () => {
                noise(0.25, 0.08, 0, { freq: 250 });
                arpeggio([392, 523, 659], 0.06, { vol: 0.035, at: 0.1 });
            },
        };
        (voices[kind] ?? voices.pick)();
    },
    goldRush: () => {
        arpeggio([523, 659, 784, 1047, 1319], 0.05, { vol: 0.04 });
        noise(0.5, 0.05, 0.1, { filter: "highpass", freq: 3000 });
    },
    bat: () => arpeggio([1760, 2349, 1760, 2349], 0.04, { vol: 0.02 }),
    batCatch: () => {
        noise(0.08, 0.08, 0, { filter: "bandpass", freq: 2000, q: 2 });
        arpeggio([1319, 1760, 2349, 3136], 0.045, { vol: 0.035, at: 0.04 });
    },
    marketBoom: () => {
        chord([392, 494, 587], 0.4, { type: "sawtooth", vol: 0.02 });
        chord([523, 659, 784], 0.6, { type: "sawtooth", vol: 0.02, at: 0.25 });
    },
    marketCrash: () => {
        tone(880, 0.6, { type: "sawtooth", slide: -760, vol: 0.03 });
        noise(0.4, 0.07, 0.3, { freq: 400 });
    },
    marketMoon: () => {
        noise(0.9, 0.06, 0, { filter: "bandpass", freq: 300, sweep: 4000, q: 1.5 });
        tone(220, 0.9, { type: "triangle", slide: 1600, vol: 0.03 });
        arpeggio([1047, 1319, 1568, 2093], 0.06, { vol: 0.03, at: 0.8 });
    },
    marketTurn: () => arpeggio([392, 370], 0.1, { type: "triangle", vol: 0.04 }),
    comboTap: (count, tier) => {
        const steps = [0, 3, 5, 7, 10];
        const semi = steps[count % 5] + 12 * (Math.floor(count / 5) % 2) + tier * 2;
        const f = 196 * 2 ** (semi / 12);
        tone(f, 0.05, { type: tier >= 5 ? "triangle" : "square", vol: 0.016 + tier * 0.003 });
        if (tier >= 6) tone(f * 2, 0.06, { type: "sine", vol: 0.012 });
    },
    comboTier: (tier) => {
        const root = 262 * 2 ** ((tier * 2) / 12);
        arpeggio([1, 1.25, 1.5, 2, 2.5].slice(0, 2 + Math.ceil(tier / 2)).map((r) => root * r), 0.05, { vol: 0.035 });
        if (tier >= 8) noise(0.3, 0.05, 0.1, { filter: "highpass", freq: 4000 });
    },
    deflate: (tier) => {
        const vol = 0.025 + tier * 0.004;
        [[392, 0], [370, 0.3], [349, 0.6]].forEach(([f, at]) => tone(f, 0.28, { type: "triangle", vol, at }));
        tone(330, 1, { type: "triangle", slide: -190, vol, at: 0.9 });
    },
};

const loot = {
    coin: () => arpeggio([988, 1319], 0.05, { vol: 0.03 }),
    // A chest lands in the stash.
    chestDrop: () => {
        tone(220, 0.08, { type: "triangle", slide: -80, vol: 0.06 });
        noise(0.06, 0.08, 0, { freq: 600 });
        arpeggio([880, 1319], 0.05, { type: "triangle", vol: 0.03, at: 0.07 });
    },
    chest: () => arpeggio([659, 880, 1109, 1319], 0.05, { vol: 0.035 }),
    // The lid opens, one voice per rarity: common a coin, rare a chime, epic a fanfare, legendary a choir.
    reveal: (rank) => {
        noise(0.08, 0.06, 0, { filter: "bandpass", freq: 800, sweep: 1200, q: 2 });
        if (rank === 0) arpeggio([988, 1319], 0.05, { vol: 0.03, at: 0.05 });
        if (rank === 1) arpeggio([659, 880, 1109, 1319, 1760], 0.05, { type: "triangle", vol: 0.035, at: 0.05 });
        if (rank === 2) {
            arpeggio([523, 659, 784, 1047, 1319, 1568], 0.06, { vol: 0.04, at: 0.05 });
            chord([784, 1047, 1319], 0.6, { type: "triangle", vol: 0.022, at: 0.4 });
        }
        if (rank >= 3) {
            tone(65, 0.9, { type: "sawtooth", slide: 65, vol: 0.045 });
            arpeggio([523, 659, 784, 1047, 1319, 1568, 2093, 2637], 0.07, { vol: 0.045, at: 0.05 });
            chord([523, 659, 784, 1047, 1319], 1.4, { type: "sine", vol: 0.03, attack: 0.2, at: 0.6 });
            noise(0.8, 0.04, 0.6, { filter: "highpass", freq: 5000 });
        }
    },
    // Each stop of the reveal roulette, rising with it.
    roulette: (rank) => tone(note(12 + rank * 4), 0.03, { type: "triangle", vol: 0.025 }),
    // An item drops: a blip, higher and brighter for rarer finds.
    drop: (rank = 0) => {
        tone(note(19 + rank * 5), 0.05, { type: rank >= 2 ? "sine" : "triangle", vol: 0.02 + rank * 0.006 });
        if (rank >= 2) tone(note(26 + rank * 5), 0.12, { type: "sine", vol: 0.015, at: 0.05 });
    },
    gem: () => {
        arpeggio([2637, 3136, 3951], 0.04, { type: "sine", vol: 0.03 });
        tone(5274, 0.3, { type: "sine", vol: 0.012, at: 0.12 });
    },
    relic: () => {
        chord([220, 277, 330], 0.9, { type: "sine", vol: 0.03, attack: 0.25 });
        arpeggio([880, 1109, 1319, 1760], 0.08, { type: "triangle", vol: 0.025, at: 0.3 });
    },
    chester: () => {
        tone(160, 0.1, { type: "square", slide: -60, vol: 0.05 });
        tone(140, 0.1, { type: "square", slide: -60, vol: 0.05, at: 0.12 });
        arpeggio([659, 880, 1109], 0.04, { vol: 0.03, at: 0.25 });
    },
};

const world = {
    // A generic "that worked" (skins, relic slots...).
    upgrade: () => arpeggio([392, 523, 659, 784], 0.05, { vol: 0.035 }),
    // Forge: hammer on the anvil.
    anvil: () => {
        tone(1760, 0.25, { type: "triangle", vol: 0.04 });
        tone(2637, 0.18, { type: "triangle", vol: 0.025 });
        noise(0.05, 0.12, 0, { filter: "highpass", freq: 1500 });
        tone(1760, 0.2, { type: "triangle", vol: 0.025, at: 0.18 });
    },
    // A star attempt: a riser, then the verdict.
    ascend: () => {
        tone(330, 0.4, { type: "sawtooth", slide: 990, vol: 0.02, attack: 0.1 });
        arpeggio([1047, 1319, 1568, 2093, 2637], 0.05, { type: "sine", vol: 0.04, at: 0.35 });
        chord([1047, 1568, 2093], 0.8, { type: "triangle", vol: 0.022, at: 0.6 });
    },
    // The attempt fizzles: nothing lost.
    fizzle: () => {
        tone(330, 0.3, { type: "sawtooth", slide: 400, vol: 0.02, attack: 0.1 });
        tone(392, 0.4, { type: "triangle", slide: -200, vol: 0.035, at: 0.32 });
    },
    // A star cracks off: glass breaking.
    crack: () => {
        tone(330, 0.3, { type: "sawtooth", slide: 400, vol: 0.02, attack: 0.1 });
        noise(0.35, 0.12, 0.3, { filter: "highpass", freq: 3000, sweep: -1500 });
        [3520, 2794, 4186, 2349].forEach((f, i) => tone(f, 0.08, { type: "sine", vol: 0.02, at: 0.32 + i * 0.04 }));
        tone(220, 0.4, { type: "triangle", slide: -110, vol: 0.04, at: 0.35 });
    },
    // A brew bubbles in the pot.
    brew: () => {
        for (let i = 0; i < 6; i++) tone(300 + Math.random() * 500, 0.05, { type: "sine", slide: 300, vol: 0.03, at: i * 0.06 });
        arpeggio([659, 880, 1109, 1319], 0.05, { vol: 0.03, at: 0.38 });
    },
    // Drinking one: a gulp, then the effect kicks in.
    drink: () => {
        tone(200, 0.1, { type: "sine", slide: -80, vol: 0.06 });
        tone(180, 0.1, { type: "sine", slide: -80, vol: 0.06, at: 0.14 });
        arpeggio([523, 659, 784, 1047, 1319], 0.05, { vol: 0.035, at: 0.3 });
        noise(0.3, 0.04, 0.3, { filter: "highpass", freq: 4000 });
    },
    // Junk crunched into coins.
    scrap: () => {
        noise(0.15, 0.12, 0, { freq: 1200, sweep: -800 });
        tone(120, 0.1, { type: "square", vol: 0.03 });
        arpeggio([988, 1319, 1568], 0.04, { type: "triangle", vol: 0.03, at: 0.12 });
    },
    petBuy: () => {
        arpeggio([523, 659, 784, 1047, 784, 1047, 1319], 0.07, { vol: 0.04 });
        tone(1568, 0.1, { type: "sine", slide: 800, vol: 0.02, at: 0.5 });
    },
    petEquip: () => arpeggio([659, 988, 1319], 0.045, { type: "triangle", vol: 0.035 }),
    petUnequip: () => arpeggio([1319, 988, 659], 0.045, { type: "triangle", vol: 0.03 }),
    pet: () => arpeggio([1047 + Math.random() * 200, 1568], 0.04, { type: "triangle", vol: 0.03 }),
    // A pet's skill: a power-up whoosh, voiced by the pet's role.
    skill: (role) => {
        noise(0.2, 0.06, 0, { filter: "bandpass", freq: 400, sweep: 3000, q: 2 });
        const roots = { slot: 523, mine: 392, idle: 440, helper: 587, legend: 330, buddy: 659 };
        const r = roots[role] ?? 523;
        arpeggio([r, r * 1.25, r * 1.5, r * 2], 0.05, { vol: 0.04, at: 0.12 });
        if (role === "legend") chord([r, r * 1.5, r * 2], 0.8, { type: "triangle", vol: 0.025, at: 0.35 });
    },
    slotOpen: () => {
        arpeggio([784, 988, 1175, 1568], 0.06, { type: "triangle", vol: 0.04 });
        noise(0.4, 0.04, 0.2, { filter: "highpass", freq: 5000 });
    },
    // Farm: seeds go in, crops pop out.
    plant: () => {
        noise(0.08, 0.08, 0, { freq: 350 });
        tone(330, 0.08, { type: "sine", slide: 330, vol: 0.03, at: 0.05 });
    },
    harvest: () => {
        tone(600, 0.06, { type: "sine", slide: 600, vol: 0.04 });
        arpeggio([784, 988, 1175], 0.04, { type: "triangle", vol: 0.03, at: 0.06 });
    },
    relicEquip: () => chord([440, 554, 659], 0.4, { type: "sine", vol: 0.03, attack: 0.08 }),
    reroll: () => {
        for (let i = 0; i < 8; i++) tone(note(12 + ((i * 5) % 12)), 0.04, { type: "triangle", vol: 0.02, at: i * 0.035 });
        chord([440, 554, 659], 0.4, { type: "sine", vol: 0.03, at: 0.3 });
    },
    skinBuy: () => {
        arpeggio([784, 988, 1175, 1568, 1976], 0.05, { type: "triangle", vol: 0.04 });
        noise(0.4, 0.05, 0.2, { filter: "highpass", freq: 5000 });
    },
    // The vault: each hit a dull thump, the crack an explosion and a fanfare.
    vaultHit: () => {
        tone(70, 0.1, { type: "sine", slide: -20, vol: 0.06 });
        noise(0.05, 0.06, 0, { freq: 300 });
    },
    vaultCrack: () => {
        noise(0.6, 0.16, 0, { freq: 800, sweep: -700 });
        tone(55, 0.8, { type: "sawtooth", slide: -20, vol: 0.05 });
        arpeggio([523, 659, 784, 1047, 1319, 1568, 2093], 0.07, { vol: 0.045, at: 0.4 });
        chord([523, 784, 1047, 1319], 1.2, { type: "triangle", vol: 0.025, at: 0.9 });
    },
    vipUp: () => {
        arpeggio([392, 494, 587, 784], 0.08, { type: "sawtooth", vol: 0.025 });
        chord([784, 988, 1175, 1568], 1, { type: "triangle", vol: 0.03, at: 0.32 });
        noise(0.6, 0.04, 0.32, { filter: "highpass", freq: 5000 });
    },
};

// Build the public table: every sound on its bus, throttled where spam would turn it to mush.
const THROTTLE = { drop: 70, sizzle: 180, ice: 90, vaultHit: 120, cartFull: 250, heatLost: 300, roulette: 25, coin: 40 };
const build = (id, group) => Object.fromEntries(Object.entries(group).map(([name, fn]) => [name, on(id, fn, THROTTLE[name] ?? 0)]));

export const sfx = {
    ...build("ui", ui),
    ...build("slot", slot),
    ...build("mine", mine),
    ...build("loot", loot),
    ...build("world", world),
};

let hum = null;

// The machine's hum while auto-spinning stays on the slot bus.
export const drone = {
    start() {
        if (!enabled || hum) return;
        const a = context();
        const t = a.currentTime;
        const gain = a.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.03, t + 0.6);
        const low = a.createOscillator();
        const high = a.createOscillator();
        const lfo = a.createOscillator();
        const depth = a.createGain();
        low.type = "sine";
        low.frequency.value = 110;
        high.type = "triangle";
        high.frequency.value = 165;
        lfo.frequency.value = 5;
        depth.gain.value = 8;
        lfo.connect(depth).connect(high.frequency);
        low.connect(gain);
        high.connect(gain);
        gain.connect(buses.slot ?? master);
        [low, high, lfo].forEach((o) => o.start());
        hum = { gain, voices: [low, high], all: [low, high, lfo] };
    },
    stop() {
        if (!hum) return;
        const a = context();
        const t = a.currentTime;
        hum.voices.forEach((o) => o.frequency.exponentialRampToValueAtTime(35, t + 1.2));
        hum.gain.gain.cancelScheduledValues(t);
        hum.gain.gain.setValueAtTime(hum.gain.gain.value, t);
        hum.gain.gain.linearRampToValueAtTime(0.0001, t + 1.2);
        hum.all.forEach((o) => o.stop(t + 1.3));
        hum = null;
    },
};
