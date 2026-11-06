# Maxwell's Manual of Malicious Maladies - A module for all your lingering injuries needs (dnd5e)
208 lingering injuries all with different severities, durations, and consequences, based on the 13 different damage types.

Every injury links to an item in the **Injuries** compendium that carries automated active effects (conditions, disadvantage, speed and AC penalties, ongoing damage, cumulative penalties, rolled durations) wherever the dnd5e system can automate what the injury describes. Everything else stays as text.

## Before opening an issue read [THIS](https://github.com/theripper93/Levels/blob/v9/ISSUES.md)

![Latest Release Download Count](https://img.shields.io/github/downloads/theripper93/Maxwell-s-Manual-of-Malicious-Maladies/latest/module.zip?color=2b82fc&label=DOWNLOADS&style=for-the-badge) ![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftheripper93%2FMaxwell-s-Manual-of-Malicious-Maladies%2Fmain%2Fmodule.json&label=Foundry%20Version&query=$.compatibility.verified&colorB=orange&style=for-the-badge) [![alt-text](https://img.shields.io/badge/-Patreon-%23ff424d?style=for-the-badge)](https://www.patreon.com/theripper93) [![alt-text](https://img.shields.io/badge/-Discord-%235662f6?style=for-the-badge)](https://discord.gg/F53gBjR97G)

## You can check the full documentation on the [WIKI](https://theripper93.com/wiki/index.php/Maxwell%27s_Manual_of_Malicious_Maladies)

## Development

- `npm install`
- `npm run watch` / `npm run build` bundles `scripts/` and `scss/` into `index.js` and `styles/module.css`.
- Compendium sources live in `src/packs/<pack>/*.json`.
  - `npm run packs:build` compiles them into `packs/` (Foundry must not have the world open, LevelDB is locked while it runs).
  - `npm run packs:extract` writes changes made in Foundry back to JSON.
