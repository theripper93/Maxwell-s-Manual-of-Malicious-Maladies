import { MODULE_ID } from "./main.js";
import { Injuries } from "./injuries.js";

const TABLE_SUFFIX = " - [MMMM]";
const SUBTABLES = ["Scar Chart", "Small Appendage Table", "Large Limb Table"];

export class MaxwelMaliciousMaladies {
    static getPack() {
        return game.packs.get(`${MODULE_ID}.mmmm`);
    }

    static normalizeTableName(name) {
        name = name.trim().replace(TABLE_SUFFIX, "");
        return name.charAt(0).toUpperCase() + name.slice(1) + TABLE_SUFFIX;
    }

    static async getTable(name) {
        const fullName = this.normalizeTableName(name);
        const worldTable = game.tables.getName(fullName);
        if (worldTable) return worldTable;
        const entry = this.getPack().index.find((e) => e.name.toLowerCase() === fullName.toLowerCase());
        return entry ? this.getPack().getDocument(entry._id) : null;
    }

    static getInjuryTableNames() {
        return this.getPack()
            .index.map((e) => e.name.replace(TABLE_SUFFIX, ""))
            .filter((n) => !SUBTABLES.includes(n))
            .sort((a, b) => a.localeCompare(b));
    }

    static async rollTable(name, { actor, damage, reason } = {}) {
        const table = await this.getTable(name);
        if (!table) return this.displayDialog();
        const { roll, results } = await table.draw({ displayChat: false });
        if (!results.length) return null;
        const injury = results[0].documentUuid ? await fromUuid(results[0].documentUuid) : null;
        const location = injury ? await Injuries.rollLocation(injury.flags[MODULE_ID]?.location) : null;
        const durations = injury ? await Injuries.rollDurations(injury) : [];
        const displayed = injury ? [results[0].clone({ description: Injuries.applyDurationsToText(results[0].description, injury, durations) }, { keepId: true }), ...results.slice(1)] : results;
        const flags = { [MODULE_ID]: { injuryUuid: injury?.uuid ?? null, location, durations, damage: damage ?? null, actorUuid: actor?.uuid ?? null, reason: reason ?? null } };
        const speaker = actor ? ChatMessage.implementation.getSpeaker({ actor }) : undefined;
        return table.toMessage(displayed, { roll, messageData: { flags, ...(speaker ? { speaker } : {}) } });
    }

    static onRenderChatMessage(message, html) {
        const data = message.flags[MODULE_ID];
        if (!data?.injuryUuid) return;
        const results = html.querySelector(".table-results");
        if (!results) return;
        if (data.location) {
            const location = document.createElement("p");
            location.classList.add("mmm-location");
            location.innerHTML = `<strong>${game.i18n.localize("mmm.chat.location")}:</strong> ${data.location}`;
            results.after(location);
        }
        if (data.applied) {
            const applied = document.createElement("div");
            applied.classList.add("mmm-applied");
            applied.innerHTML = data.applied;
            (html.querySelector(".mmm-location") ?? results).after(applied);
            return;
        }
        const actor = data.actorUuid ? fromUuidSync(data.actorUuid) : null;
        if (!game.user.isGM && !actor?.isOwner) return;
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("mmm-apply");
        button.innerHTML = `<i class="fas fa-viruses"></i> ${game.i18n.localize("mmm.chat.apply")}`;
        button.addEventListener("click", (event) => {
            event.preventDefault();
            button.disabled = true;
            this.applyFromMessage(message).finally(() => (button.disabled = false));
        });
        (html.querySelector(".mmm-location") ?? results).after(button);
    }

    static async applyFromMessage(message) {
        const data = message.flags[MODULE_ID];
        const speakerActor = ChatMessage.implementation.getSpeakerActor(message.speaker);
        const actor = (data.actorUuid ? await fromUuid(data.actorUuid) : null) ?? speakerActor ?? canvas.tokens.controlled[0]?.actor;
        if (!actor) return ui.notifications.error("mmm.notifications.noActor", { localize: true });
        return Injuries.apply(actor, data.injuryUuid, { damage: data.damage, location: data.location, durations: data.durations, messageId: message.id });
    }

    static getTableSelect() {
        const options = this.getInjuryTableNames()
            .map((name) => `<option value="${name}">${name}</option>`)
            .join("");
        return `<div class="form-group"><select name="table">${options}</select></div>`;
    }

    static async displayDialog() {
        const tableName = await foundry.applications.api.DialogV2.prompt({
            window: { title: "mmm.title" },
            content: `<p>${game.i18n.localize("mmm.dialog.chooseTable")}</p>${this.getTableSelect()}`,
            ok: {
                icon: "fas fa-dice-d20",
                label: "mmm.dialog.roll",
                callback: (event, button) => button.form.elements.table.value,
            },
            rejectClose: false,
        });
        if (tableName) return this.rollTable(tableName);
    }

    static async confirmInjury({ reason, tablename, actor, damage }) {
        const hasTable = tablename && this.getInjuryTableNames().some((n) => n.toLowerCase() === tablename.toLowerCase());
        const damageLabel = hasTable ? game.i18n.localize(CONFIG.DND5E.damageTypes[tablename]?.label ?? tablename) : "";
        const prompt = hasTable ? game.i18n.format("mmm.dialog.rollOnTable", { damage: damageLabel }) : game.i18n.localize("mmm.dialog.selectDamageType");
        const select = hasTable ? "" : this.getTableSelect();
        const content = `<p class="mmm-dialog">${game.i18n.format("mmm.dialog.sustained", { actor: foundry.utils.escapeHTML(actor.name) })}<br>${game.i18n.localize("mmm.dialog.reason")}: <strong>${game.i18n.localize(reason)}</strong>.<br>${prompt}</p>${select}`;
        const tableName = await foundry.applications.api.DialogV2.prompt({
            window: { title: "mmm.title" },
            content,
            ok: {
                icon: "fas fa-dice-d20",
                label: "mmm.dialog.roll",
                callback: (event, button) => button.form.elements.table?.value ?? tablename,
            },
            rejectClose: false,
        });
        if (!tableName) return;
        actor.getActiveTokens()[0]?.control();
        return this.rollTable(tableName, { actor, damage, reason });
    }

    static isOwnerConnected(actor) {
        return game.users.some((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
    }

    static async requestRoll({ reason, tablename, uuid, damage }) {
        const actor = await fromUuid(uuid);
        if (!actor) return;
        const ownerConnected = MaxwelMaliciousMaladies.isOwnerConnected(actor);
        const shouldPrompt = game.user.isGM ? !ownerConnected && game.users.activeGM?.isSelf : actor.isOwner && ownerConnected;
        if (shouldPrompt) MaxwelMaliciousMaladies.confirmInjury({ reason, tablename, actor, damage });
    }
}
