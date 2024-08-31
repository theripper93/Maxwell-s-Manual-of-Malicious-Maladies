import { MaxwelMaliciousMaladies } from "./maxwelMaliciousMaladies.js";
import { Socket } from "./lib/socket.js";

export const MODULE_ID = "mmm";

Hooks.once("init", function () {
    Socket.register("requestRoll", MaxwelMaliciousMaladies.requestRoll);

    game.settings.register("mmm", "applyOnDamage", {
        name: "On Damage",
        hint: "Prompt for a lingering injury roll when the damage recived is more than half of the max hp.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register("mmm", "applyOnDown", {
        name: "On Unconscious",
        hint: "Prompt for a lingering injury roll when damage brings an actor to 0 hp.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register("mmm", "applyOnCritSave", {
        name: "On fumbled Saving Throw",
        hint: "Prompt for a lingering injury roll on a fumbled saving throw. (requires MidiQoL)",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register("mmm", "applyOnCrit", {
        name: "On Critical",
        hint: "Prompt for a lingering injury roll on a critical hit. (requires MidiQoL)",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register("mmm", "triggerNpc", {
        name: "Trigger Injuries on NPCs",
        hint: "Enables the automations on non player owned actors.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });

    game.settings.register("mmm", "selfdestruct", {
        name: "Destroy items",
        hint: "When active effects expire, destroy the injury item. (requires DAE/MidiQoL)",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });
});

Hooks.on("chatMessage", (ChatLog, content) => {
    if (content.toLowerCase().startsWith("/mmmm")) {
        const data = content.replace("/mmmm", "").trim();
        if (data) {
            MaxwelMaliciousMaladies.rollTable(data);
        } else {
            MaxwelMaliciousMaladies.displayDialog();
        }

        return false;
    }
});

Hooks.on("renderChatMessage", (message, html) => {
    if (!game.user.isGM || !message?.flavor?.includes("[MMMM]")) return;
    const subTables = ["Scar Chart", "Small Appendage Table", "Large Limb Table"];
    for (let t of subTables) {
        if (message?.flavor?.includes(t)) return;
    }
    const button = $(`<a title="Apply Lingering Injury" style="margin-right: 0.3rem;color: red;" class="button"><i class="fas fa-viruses"></i></a>`);
    html.find(".result-text").prepend(button);
    button.on("click", async (e) => {
        e.preventDefault();
        let actor = game.scenes.get(message?.speaker?.scene)?.tokens?.get(message?.speaker?.token)?.actor;
        actor = actor ?? game.actors.get(message?.speaker?.actor) ?? _token?.actor;
        if (!actor) return ui.notifications.error("No token selected or actor found!");
        const content = $(message.content);
        const imgsrc = content.find("img").attr("src");
        const description = content.find(".result-text").html();
        const duration = MaxwelMaliciousMaladies.inferDuration(content.find(".result-text").text());
        const title = "Lingering Injury - " + content.find("strong").first().text();
        const itemData = {
            name: title,
            img: imgsrc,
            type: "feat",
            "system.description.value": description,
            flags: {
                mmm: {
                    lingeringInjury: true,
                },
            },
            effects: [
                {
                    icon: imgsrc,
                    label: title,
                    transfer: true,
                    changes: [
                        {
                            key: "flags.dae.deleteOrigin",
                            value: game.settings.get("mmm", "selfdestruct") ? 1 : "",
                            mode: 2,
                            priority: 0,
                        },
                    ],
                    duration: {
                        seconds: title.includes("(") ? null : duration || 9999999999,
                    },
                    description: description,
                    flags: {
                        mmm: {
                            lingeringInjury: true,
                        },
                    },
                },
            ],
        };
        actor.createEmbeddedDocuments("Item", [itemData]);
        ui.notifications.notify(`Added ${title} to ${actor.name}`);
    });
});

Hooks.on("dnd5e.calculateDamage", (actor, damages, options) => {
    options.mmmm = {originalDamages: [...damages]};
});

Hooks.on("dnd5e.applyDamage", (actor, damageTotal, options) => {
        if(damageTotal <= 0) return;
        const triggerNpc = game.settings.get("mmm", "triggerNpc");
        if (!actor.hasPlayerOwner && !triggerNpc) return;
        const damages = options.mmmm.originalDamages;
        damages.forEach((d) => {
            if (!d.type) d.type = d.value < 0 ? "healing" : "";
        });
        const damagesNoHealing = damages.filter((d) => d.type !== "healing");
        if (!damagesNoHealing.length) return;
        const damagesSorted = damagesNoHealing.sort((a, b) => b.value - a.value);
        const highestDamageType = damagesSorted[0].type;

        const hpMax = actor.system.attributes.hp.effictiveMax;
        const hpCurrent = actor.system.attributes.hp.value;
        const isHalfOrMore = damageTotal >= hpMax / 2;
        const isDead = hpCurrent === 0;
        const isCrit = options?.midi?.isCritical;
        const isCritSave = options?.midi?.fumbleSave;
        if (isDead && actor.hasPlayerOwner && game.settings.get("mmm", "applyOnDown")) {
            Socket.requestRoll({ reason: "Downed", tablename: highestDamageType, uuid: actor.uuid });
            return;
        }
        if (isHalfOrMore && game.settings.get("mmm", "applyOnDamage")) {
            Socket.requestRoll({ reason: "Damage exeded half of maximum hp", tablename: highestDamageType, uuid: actor.uuid });
            return;
        }
        if (isCrit && game.settings.get("mmm", "applyOnCrit")) {
            Socket.requestRoll({ reason: "Critical Hit", tablename: highestDamageType, uuid: actor.uuid });
            return;
        }
        if (isCritSave && game.settings.get("mmm", "applyOnCritSave")) {
            Socket.requestRoll({ reason: "Fumbled Saving Throw", tablename: highestDamageType, uuid: actor.uuid });
            return;
        }
    });