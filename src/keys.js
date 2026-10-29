// Every keyboard shortcut in one place. main.js binds these codes, and the in-game guide, the tour and the web
// page's side panels all describe them from this list, so a hint can never name the wrong keys.
//
// `caps` are the keycaps shown (`alt` an equivalent set), `codes` the KeyboardEvent.code values that trigger it,
// `group` where it belongs: a dock tab (slot, mine, farm, bag) or "any" for keys that work everywhere.

export const MINE_CODES = ["KeyH", "KeyJ", "KeyK", "KeyL"];

export const HOTKEYS = [
    { group: "slot", caps: ["SPACE"], alt: ["ENTER"], label: "SPIN / STOP / SKIP", codes: ["Space", "Enter"] },
    { group: "slot", caps: ["←", "→"], alt: ["-", "="], label: "BET DOWN / UP", codes: ["ArrowLeft", "ArrowRight", "Minus", "Equal"] },
    { group: "slot", caps: ["A"], label: "AUTO SPIN", codes: ["KeyA"] },
    { group: "mine", caps: ["H", "J", "K", "L"], label: "MINE: SPAM THEM", codes: MINE_CODES },
    { group: "mine", caps: ["SPACE"], label: "MINE ON THE MINE TAB", codes: ["Space"] },
    { group: "mine", caps: ["S"], label: "SELL ORE", codes: ["KeyS"] },
    { group: "any", caps: ["O"], label: "OPEN A CHEST", codes: ["KeyO"] },
    { group: "any", caps: ["SHIFT", "O"], label: "OPEN EVERY CHEST", codes: ["KeyO"] },
    { group: "any", caps: ["Q"], label: "FIRE EVERY READY PET SKILL", codes: ["KeyQ"] },
    { group: "any", caps: ["P"], label: "PETS", codes: ["KeyP"] },
    { group: "any", caps: ["1", "2", "3", "4"], label: "SLOT / MINE / FARM / BAG", codes: ["Digit1", "Digit2", "Digit3", "Digit4"] },
    { group: "any", caps: ["B"], label: "BAG", codes: ["KeyB"] },
    { group: "any", caps: ["F"], label: "FORGE", codes: ["KeyF"] },
    { group: "any", caps: ["Y"], label: "HISTORY", codes: ["KeyY"] },
    { group: "any", caps: ["ESC"], label: "CLOSE", codes: ["Escape"] },
];
