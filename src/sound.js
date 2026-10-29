let audio = null;
let master = null;
let volume = 1;
let enabled = true;
let lastTick = 0;
let lastClack = 0;

export const setSound = (on) => {
    enabled = on;
    if (!on) drone.stop();
};

export const setVolume = (v) => {
    volume = v;
    if (master) master.gain.value = volume;
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
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
}

function tone(freq, dur, { type = "square", vol = 0.04, at = 0, slide = 0 } = {}) {
    if (!enabled) return;
    const a = context();
    const t = a.currentTime + at;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.05, at = 0) {
    if (!enabled) return;
    const a = context();
    const t = a.currentTime + at;
    const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = a.createBufferSource();
    const filter = a.createBiquadFilter();
    const gain = a.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.value = vol;
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
}

const arpeggio = (notes, step, opts) => notes.forEach((f, i) => tone(f, step * 1.4, { ...opts, at: i * step }));

export const sfx = {
    click: () => tone(880, 0.03, { vol: 0.02 }),
    sixSeven: () => {
        tone(60, 0.35, { type: "sine", slide: -25, vol: 0.12 });
        noise(0.06, 0.12);
        tone(620, 0.14, { slide: -120, vol: 0.05, at: 0.04 });
        noise(0.05, 0.1, 0.24);
        tone(560, 0.1, { slide: -60, vol: 0.05, at: 0.28 });
        tone(420, 0.22, { slide: -90, vol: 0.05, at: 0.4 });
    },
    tab: () => {
        tone(1200, 0.015, { slide: -500, vol: 0.03 });
        noise(0.012, 0.06);
    },
    clink: () => {
        tone(2093, 0.06, { type: "triangle", vol: 0.04 });
        tone(2637, 0.08, { type: "triangle", vol: 0.035, at: 0.04 });
    },
    thud: () => {
        tone(110, 0.09, { type: "triangle", slide: -50, vol: 0.07 });
        noise(0.05, 0.08);
    },
    spin: () => tone(196, 0.14, { slide: 300, vol: 0.03 }),
    reel: (i) => tone(150 + i * 45, 0.07, { type: "triangle", vol: 0.09 }),
    perfect: () => arpeggio([988, 1319, 1760], 0.05, { vol: 0.035 }),
    good: () => arpeggio([784, 988], 0.05, { vol: 0.03 }),
    miss: () => tone(170, 0.09, { type: "triangle", vol: 0.05 }),
    win: () => arpeggio([523, 659, 784], 0.07, { vol: 0.035 }),
    big: () => arpeggio([523, 659, 784, 1047, 784, 1047, 1319], 0.07, { vol: 0.04 }),
    jackpot: () => arpeggio([523, 659, 784, 1047, 1319, 1047, 1319, 1568, 2093], 0.08, { vol: 0.045 }),
    lose: () => tone(220, 0.2, { type: "triangle", slide: -90, vol: 0.05 }),
    near: () => arpeggio([392, 370], 0.1, { type: "triangle", vol: 0.05 }),
    // Reel clack: a "tít" beep plus a "tạch" snap per symbol; louder and lower as the reel slows down.
    clack: (i, speed) => {
        const now = performance.now();
        if (now - lastClack < 22) return;
        lastClack = now;
        const slow = 1 - speed;
        tone(2200 - slow * 700 + i * 120, 0.022, { vol: 0.04 + slow * 0.04 });
        tone(900 - slow * 300, 0.03, { slide: -600, vol: 0.05 + slow * 0.05 });
        noise(0.02, 0.16 + slow * 0.14);
    },
    tick: () => {
        const now = performance.now();
        if (now - lastTick < 45) return;
        lastTick = now;
        tone(1400, 0.02, { vol: 0.015 });
    },
    mine: () => {
        noise(0.08, 0.12);
        tone(110, 0.06, { vol: 0.03 });
    },
    lucky: () => arpeggio([1319, 1760, 2349], 0.04, { vol: 0.03 }),
    coin: () => arpeggio([988, 1319], 0.05, { vol: 0.03 }),
    upgrade: () => arpeggio([392, 523, 659, 784], 0.05, { vol: 0.035 }),
    levelUp: () => arpeggio([523, 523, 784, 784, 1047, 1319, 1568], 0.09, { vol: 0.045 }),
    bat: () => arpeggio([1760, 2349, 1760, 2349], 0.04, { vol: 0.02 }),
    chest: () => arpeggio([659, 880, 1109, 1319], 0.05, { vol: 0.035 }),
    reveal: (rank) => [sfx.coin, sfx.win, sfx.big, sfx.jackpot][rank](),
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
    talk: () => tone(500 + Math.random() * 300, 0.03, { vol: 0.012 }),
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
    },
    deflate: (tier) => {
        const vol = 0.025 + tier * 0.004;
        [[392, 0], [370, 0.3], [349, 0.6]].forEach(([f, at]) => tone(f, 0.28, { type: "triangle", vol, at }));
        tone(330, 1, { type: "triangle", slide: -190, vol, at: 0.9 });
    },
    pet: () => arpeggio([1047 + Math.random() * 200, 1568], 0.04, { type: "triangle", vol: 0.03 }),
    trophy: () => arpeggio([784, 988, 1175, 1568, 1175, 1568], 0.06, { type: "triangle", vol: 0.04 }),
    collapse: () => {
        noise(1.4, 0.14);
        tone(80, 1.6, { type: "sawtooth", slide: -50, vol: 0.04 });
        [[392, 0.5], [370, 0.85], [349, 1.2]].forEach(([f, at]) => tone(f, 0.32, { type: "triangle", vol: 0.05, at }));
        tone(330, 1.4, { type: "triangle", slide: -200, vol: 0.05, at: 1.55 });
    },
    denied: () => tone(110, 0.14, { type: "sawtooth", vol: 0.025 }),
};

let hum = null;

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
        gain.connect(master);
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
