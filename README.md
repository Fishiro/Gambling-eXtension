# Pixel Slots AFK

A Chrome extension (Manifest V3) popup game: slot machine + idle mine. Spin on your 5-minute break, let the mine work while you do.

## Features

- **Slot**: timing-meter spins, heat, cosmic stars, VIP tiers, the daily Vault.
- **Mine**: tap or spam H/J/K/L to mine ore, sell it, upgrade pick, drill and cart.
- **Ore market**: the ore price moves every minute through moods (calm, bull, bear, boom, crash). Dumping lots of ore at once crashes it, selling a little lifts it.
- **Farm**: timed expeditions and a garden.
- **Bag & Forge**: items, gear, brews, relics.
- **Pets, skins, achievements, chests**.

## Play on the web

`index.html` is the web version: the same game, scaled to fill the screen, with side panels listing the keys for
the tab you are on (they light up as you press them). On narrow screens the panels hide and the game fills the
width. ES modules need a web server, so open it through one, not as a file:

```
python -m http.server 8000     # then open http://localhost:8000
```

Any static host works (GitHub Pages serves `index.html` from the repo root). Progress saves in that browser.

## Install (dev)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder.
4. Pin the extension and open the popup.

There is no build step. After editing, hit the reload icon on the extension card and reopen the popup.

## Layout

```
manifest.json        extension manifest
popup.html/.css      the whole UI
src/main.js          entry point, wires every module together
src/core/            pure game logic, no DOM (config, economy, items, luck, farming, market, save...)
src/store.js         live game state, saved to localStorage under "gx_state"
src/*.js             one UI module per feature (slot, mine, farm, pets, ...)
tests/               node --test suites (logic, saves, balance, import graph)
index.html, web/     the web version: a wide-screen page around popup.html with key hints
tools/               balance report, bot simulator, sprite animator (not part of the extension)
docs/                game design document and research notes
assets/, icons/      fonts and icons
```

## Tests and balance

Needs Node 20+, nothing to install.

```
npm test            # all tests
npm run report      # difficulty curve, slot return, mine payback, bot playthroughs
```
