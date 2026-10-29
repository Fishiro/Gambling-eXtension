# CLAUDE.md

Chrome extension (MV3) popup game "Pixel Slots AFK": slot machine + idle mine + farm. Plain ES modules, no build step, no dependencies, no tests.

## Running

Load the folder unpacked at `chrome://extensions` (Developer mode), then reload the extension after changes. `popup.html` loads `src/main.js` as a module.

## Architecture

- `src/config.js`: every balance number lives here. Tune numbers here, not inline in feature modules.
- `src/store.js`: single `state` object, persisted to `localStorage` key `gx_state`. Call `commit()` after mutating. New state fields need a default in `fresh()` so old saves load cleanly.
- `src/economy.js`: pure formulas (payouts, XP curve, upgrade cost/value, ore).
- Ore is never ticked: `state.ore` is the cart at `state.mineAt`, the rest is derived from timestamps (`oreAt`). Call `econ.settleOre(state)` before anything that reads or changes ore, rate, cap or gold rush. Anything that runs while the popup is closed must work the same way (timestamps, not intervals).
- `src/events.js`: tiny `emit`/`on` bus (`tap`, `sell`, `drops`, ...) used by achievements and other listeners.
- Feature modules export a `createX(...)` factory returning `{ render, ... }`; `main.js` wires them and runs a once-a-second loop.
- `fx.js`, `sound.js`, `sprites.js`: visuals, sfx, SVG pixel icons. UI text lives in `text.js`.

## Conventions

- 4-space indent, double quotes, ES module imports with `.js` extension.
- UI text is uppercase pixel style (Silkscreen font).
- Bump `version` in `manifest.json` for releases.
- Main branch: `main`. Remote: https://github.com/Fishiro/Gambling-eXtension.git
