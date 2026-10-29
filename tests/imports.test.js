import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The extension has no bundler, so a broken import only shows up as a blank popup. This walks every module
// under src/ and checks each relative import points at a real file that exports every name it asks for.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : []));
const sources = files(join(root, "src"));

function exportsOf(file) {
    const src = readFileSync(file, "utf8");
    const names = new Set();
    for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(",").forEach((n) => n.trim() && names.add(n.trim().split(/\s+as\s+/).pop()));
    return names;
}

test("every relative import resolves to a file and its named exports", () => {
    for (const file of sources) {
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(/import\s+(?:([\s\S]*?)\s+from\s+)?"(\.[^"]+)"/g)) {
            const target = resolve(dirname(file), m[2]);
            assert.ok(existsSync(target), `${file}: missing module ${m[2]}`);
            const named = m[1]?.match(/\{([\s\S]*)\}/)?.[1];
            if (!named) continue;
            const have = exportsOf(target);
            for (const raw of named.split(",")) {
                const name = raw.trim().split(/\s+as\s+/)[0];
                if (name) assert.ok(have.has(name), `${file}: ${m[2]} has no export "${name}"`);
            }
        }
    }
});

test("core modules never touch the DOM or storage", () => {
    for (const file of sources.filter((f) => f.includes(join("src", "core")))) {
        const src = readFileSync(file, "utf8");
        // Comments and strings may say "window"; only code counts.
        const code = src.replace(/\/\/.*$/gm, "").replace(/"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
        // Property keys (`window: 900`) and members (`x.window`) are not the globals.
        const hit = code.match(/(?<![.\w$])(document|window|localStorage|sessionStorage)\b(?!\s*:)/);
        assert.ok(!hit, `${file} must stay pure, uses ${hit?.[0]}`);
        for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) assert.ok(!m[1].startsWith(".."), `${file} imports outside core: ${m[1]}`);
    }
});

test("popup.html loads the entry module", () => {
    const html = readFileSync(join(root, "popup.html"), "utf8");
    const entry = html.match(/<script[^>]+src="([^"]+)"/)[1];
    assert.ok(existsSync(join(root, entry)), `popup.html points at missing ${entry}`);
});

test("every module parses", () => {
    for (const file of sources) {
        try {
            execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
        } catch (e) {
            assert.fail(`${file} does not parse:\n${e.stderr}`);
        }
    }
});
