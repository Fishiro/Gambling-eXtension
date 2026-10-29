# Pixel Slots AFK

A Chrome extension (Manifest V3) popup game: slot machine + idle mine. Spin on your 5-minute break, let the mine work while you do.

## Features

- **Slot**: timing-meter spins, heat, cosmic stars, VIP tiers, the daily Vault.
- **Mine**: tap or spam H/J/K/L to mine ore, sell it, upgrade pick, drill and cart.
- **Ore market**: the ore price moves every minute through moods (calm, bull, bear, boom, crash). Dumping lots of ore at once crashes it, selling a little lifts it.
- **Farm**: timed expeditions and a garden.
- **Bag & Forge**: items, gear, brews, relics.
- **Pets, skins, achievements, chests**.

## Play on the web (wide screen)

The same game on a full page: it scales to fit the screen, and wide screens get side panels with the keys for
the tab you are on. Progress is shared with the popup when opened from the extension. Three ways to open it:

1. **From the extension:** click the expand button (four corners) at the top of the popup. It opens in a tab.
2. **Double-click `play.bat`** (Windows, needs [Node.js](https://nodejs.org)). It starts a small local server and
   opens the browser; close the black window to stop it.
3. **Any terminal:** `npm run web` (or `python -m http.server 8765`), then open http://localhost:8765.

Opening `index.html` straight from the folder shows a blank page: browsers block ES modules on `file://`.
Any static host works too (GitHub Pages serves `index.html` from the repo root).

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
