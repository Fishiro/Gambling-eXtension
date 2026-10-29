# CLAUDE.md

Chrome extension (MV3) popup game "Pixel Slots AFK": slot machine + idle mine + farm. Plain ES modules, no build step, no dependencies. Design intent, rejected ideas and open questions: `docs/game-design.md` (read it before changing balance or adding content).

## Running

Load the folder unpacked at `chrome://extensions` (Developer mode), then reload the extension after changes. The manifest points at `src/popup.html`, which loads `src/main.js` as a module.

Root = only what runs the game or what a tool needs there (`manifest.json`, `index.html`, `play.bat`, `package.json`, docs for people). Everything else goes in a folder: `src/` (game, including popup.html/css), `assets/` (fonts, `assets/icons/`), `web/`, `tests/`, `tools/`, `docs/`. `tests/imports.test.js` checks every path in the manifest, the two pages and the CSS.

## Testing

- `npm test`: Node's built-in runner, no install. Core logic, save migration/sanitizing, the import graph, and balance thresholds (slot return, difficulty, XP, bots). Run it after every change.
- `npm run report`: difficulty/XP curves, slot return per build, mine payback, bot playthroughs, chest odds.
- A failing balance test means a design decision: update `docs/game-design.md` section 9 with the reason, don't just loosen the number.

## Architecture

- `src/core/`: pure game logic, no DOM or storage (a test enforces it), runs in Node. Everything balance-related goes here.
  - `config.js`: every balance number lives here. Tune numbers here, not inline in feature modules.
  - `economy.js`: formulas (payouts, `spinBoost`, `difficulty` curve, meter, XP curve, upgrades, ore).
  - `items.js` (bag, gear, `bonus` with `STAT_CAPS` soft caps), `luck.js` (chests, pity, rewards, scrap), `farming.js`, `market.js`, `relics.js`, `vip.js`.
  - `save.js`: `freshState()`, `SAVE_VERSION`, `migrate()`, `sanitize()`, `restore()`. A new state field needs a default in `freshState()` and a rule in `sanitize()`; a field that changes meaning needs `SAVE_VERSION + 1` and a migration step.
- `src/store.js`: the live `state`, persisted to `localStorage` key `gx_state` via `core/save.restore`. Call `commit()` after mutating.
- Pass `rand` / `now` into core functions instead of reading `Math.random` / `Date.now` where a test or the bot needs control.
- Ore is never ticked: `state.ore` is the cart at `state.mineAt`, the rest is derived from timestamps (`oreAt`). Call `econ.settleOre(state)` before anything that reads or changes ore, rate, cap or gold rush. Anything that runs while the popup is closed must work the same way (timestamps, not intervals).
- `src/events.js`: tiny `emit`/`on` bus (`tap`, `sell`, `drops`, ...) used by achievements and other listeners.
- Feature modules export a `createX(...)` factory returning `{ render, ... }`; `main.js` wires them and runs a once-a-second loop.
- `fx.js`, `sound.js`, `sprites.js`: visuals, sfx, SVG pixel icons. UI text lives in `text.js`.
- `sound.js`: every sound is synthesized (no files) and plays on a category bus (`BUSES`: ui, slot, mine, loot, world) with its own volume in Settings. A new event gets its own sound in the right bus group; spammable sounds go in `THROTTLE`. `tests/sound.test.js` fails on any `sfx.x` that doesn't exist.
- Bag views: `bag.js` owns ITEMS and the tab switching; `forge.js` is the FORGE (an anvil you drag gear onto from a shelf grouped by set, pointer-event drag with click as a fallback, an animated drag demo while empty); `brewery.js` is the BREW view (brew and drink in place).
- `src/confirm.js`: `confirmSpend` asks before anything that costs diamonds (or risks a star): cost as have/need chips, diamonds left after. Every diamond spend must go through it.
- `src/about.js`: the menu's ABOUT page (project + developer). Its links live in `LINKS` (the dev's site; `donate` is empty until the Ko-fi page exists, and the button says "coming soon" meanwhile). Every link asks before leaving the game and opens in a new tab.
- `src/radial.js`: the right-click quick menu (the browser's own context menu is off, except in text fields): a pie around the pointer, the menu button as its hub and the four tabs as SVG ring slices cut apart at the top, right, bottom and left.
- `src/keys.js`: every keyboard shortcut. `main.js` binds these codes; the guide, the tour and the web page describe them from this list. Add or change a key here, never only in a hint (`tests/keys.test.js` checks both).
- `index.html` + `web/`: the web version. It runs `src/popup.html?web` full-size (the game's own layout is responsive) and fills the side panels from `keys.js` and `TEXT.web`; it listens to the game's `gx:tab-*` events. The extension never loads it.
- `tools/sim.js`: seeded bot + slot Monte Carlo on top of `src/core`; `tools/animator.html`: standalone sprite tool.

## Conventions

- 4-space indent, double quotes, ES module imports with `.js` extension.
- UI text is uppercase pixel style (Silkscreen font).
- Size: type is in pt (`--fs-0..3` = 7/10/13/20pt) so it never balloons; every icon goes through `svgIcon`/`svgFit`, which multiply by `sprites.UI_SCALE` (1.125), so call sites keep thinking in the original 1x scales. Use `svgFit(name, box)` wherever icons of different sprite sizes sit side by side. The popup is 780x580 (20px under Chrome's 800x600 limit, so display scaling never adds a scrollbar), and the page itself never scrolls (panels do). `src/mode.js` adds `html.web` when the page is loaded with `?web` (the web version): then the game box is responsive up to 1280x840 and stops there, centred, with the gold frame around the box (`.app::after`; `.app::before` is the side column's background); the slot machine and mine scene size to the box height too; below 960x620 it zooms `#app` down to fit rather than scroll. web/shell.css caps the page the same way so the hint panels stay beside the game. The web page (web/shell.js) owns the key hint panels and tells the game over `postMessage` whether they fit; the game's `#btn-keys` (web only) asks it to show or hide them.
- `#boot` in src/popup.html is the first frame (plain HTML/CSS); main.js lifts it once the game is drawn.
- Bump `version` in `manifest.json` with every change pushed:
  - `X.0.0` major: refactor / restructure.
  - `0.X.0` minor: game update, new content, security fix or major bug fix.
  - `0.0.X` patch: small bug fix or small improvement.
- Main branch: `main`. Remote: https://github.com/Fishiro/Gambling-eXtension.git
