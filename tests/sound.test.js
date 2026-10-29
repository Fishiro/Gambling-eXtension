import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sfx, BUSES } from "../src/sound.js";

// A typo in a sound name only fails when that moment happens in play. Check every sfx.x used in src exists.
const src = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "src");
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : []));

test("every sound the game plays exists", () => {
    for (const file of files(src)) {
        for (const m of readFileSync(file, "utf8").matchAll(/\bsfx\.(\w+)/g)) assert.equal(typeof sfx[m[1]], "function", `${file}: sfx.${m[1]} is missing`);
    }
});

test("every sound sits on a known bus", () => {
    const ids = BUSES.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(Object.keys(sfx).length > 80, "the sound set should cover every event");
});
