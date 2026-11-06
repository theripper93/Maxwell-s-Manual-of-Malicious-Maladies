import { MODULE_ID } from "./main.js";

export function registerSettings() {
    const settings = {
        applyOnDamage: {
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
        },
        damageThreshold: {
            scope: "world",
            config: true,
            type: Number,
            range: { min: 0.1, max: 1, step: 0.05 },
            default: 0.5,
        },
        applyOnDown: {
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
        },
        applyOnCrit: {
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
        },
        applyOnCritSave: {
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
        },
        triggerNpc: {
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
        },
        selfdestruct: {
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
        },
        autoApplyOngoing: {
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
        },
    };

    for (const [key, value] of Object.entries(settings)) {
        value.name ??= `${MODULE_ID}.settings.${key}.name`;
        value.hint ??= `${MODULE_ID}.settings.${key}.hint`;
        game.settings.register(MODULE_ID, key, value);
    }
}

export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}
