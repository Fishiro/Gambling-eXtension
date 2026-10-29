# Pixel Slots AFK

A Chrome extension (Manifest V3) popup game: slot machine + idle mine. Spin on your 5-minute break, let the mine work while you do.

## Features

- **Slot**: timing-meter spins, heat, cosmic stars, VIP tiers, the daily Vault.
- **Mine**: tap or spam H/J/K/L to mine ore, sell it, upgrade pick, drill and cart.
- **Farm**: timed expeditions and a garden.
- **Bag & Forge**: items, gear, brews, relics.
- **Pets, skins, achievements, chests**.

## Install (dev)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder.
4. Pin the extension and open the popup.

There is no build step. After editing, hit the reload icon on the extension card and reopen the popup.

## Layout

```
manifest.json     extension manifest
popup.html/.css   the whole UI
src/main.js       entry point, wires every module together
src/config.js     all balance numbers (odds, costs, drops, pets...)
src/store.js      game state, saved to localStorage under "gx_state"
src/economy.js    pure formulas (payouts, XP, ore, upgrade costs)
src/*.js          one module per feature (slot, mine, farm, pets, ...)
animator.html     standalone sprite animator tool (not part of the extension)
assets/, icons/   fonts and icons
```
