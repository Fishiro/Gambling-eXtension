import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HOTKEYS, MINE_CODES } from "../src/keys.js";

const src = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "src");
const read = (file) => readFileSync(join(src, file), "utf8");

test("every key the hints describe is really bound", () => {
    const main = read("main.js");
    for (const k of HOTKEYS) {
        for (const code of k.codes) {
            const bound = MINE_CODES.includes(code) || new RegExp(`\\b${code}\\b`).test(main);
            assert.ok(bound, `${k.caps.join("+")} (${code}) is described but main.js never binds it`);
        }
    }
});

test("hints that name the mining keys name all of them", () => {
    const caps = HOTKEYS.find((k) => k.codes === MINE_CODES).caps;
    for (const file of ["text.js", "guide.js", "tutorial.js"]) {
        for (const m of read(file).matchAll(/\b[HJKL](?:[ /]+[HJKL]\b)+/g)) {
            assert.deepEqual(m[0].split(/[ /]+/), caps, `${file}: "${m[0]}" should be ${caps.join(" ")}`);
        }
    }
    const tour = read("tutorial.js");
    assert.match(tour, /tap: \["Space", \.\.\.MINE_CODES\]/, "the tour must accept every mining key");
});
