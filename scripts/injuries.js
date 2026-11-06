import { MODULE_ID } from "./main.js";
import { MaxwelMaliciousMaladies } from "./maxwelMaliciousMaladies.js";

const LOCATION_TABLES = {
    largeLimb: "Large Limb Table",
    smallAppendage: "Small Appendage Table",
    scar: "Scar Chart",
};

export class Injuries {
    static isInjury(item) {
        return !!item?.flags?.[MODULE_ID]?.injury;
    }

    static getTierFormula(tiers, damage) {
        if (!tiers?.length) return null;
        const index = Math.clamp(Math.ceil((Number(damage) || 1) / 10) - 1, 0, tiers.length - 1);
        return tiers[index];
    }

    static async rollLocation(location) {
        if (!location?.table) return null;
        const count = location.count ?? 1;
        const parts = [];
        for (let i = 0; i < count; i++) {
            if (location.table === "side") {
                const side = game.i18n.localize(Math.random() < 0.5 ? "mmm.location.left" : "mmm.location.right");
                parts.push(`${side} ${game.i18n.localize(`mmm.location.${location.part.toLowerCase()}`)}`);
                continue;
            }
            const table = await MaxwelMaliciousMaladies.getTable(LOCATION_TABLES[location.table]);
            const { results } = (await table?.draw({ displayChat: false })) ?? { results: [] };
            const text = results[0]?.name || results[0]?.description;
            if (text) parts.push(text);
        }
        return parts.join(", ") || null;
    }

    static async promptDamage(injuryName) {
        const value = await foundry.applications.api.DialogV2.prompt({
            window: { title: "mmm.title" },
            content: `<p>${game.i18n.format("mmm.dialog.damagePrompt", { injury: injuryName })}</p><div class="form-group"><input type="number" name="damage" min="1" value="10" autofocus></div>`,
            ok: {
                label: "mmm.dialog.confirm",
                callback: (event, button) => button.form.elements.damage.valueAsNumber,
            },
            rejectClose: false,
        });
        return Number.isFinite(value) ? value : 1;
    }

    static async apply(actor, injuryUuid, { damage = null, location = null, durations = null, messageId = null } = {}) {
        const injury = await fromUuid(injuryUuid);
        if (!injury) return ui.notifications.error("mmm.notifications.noInjury", { localize: true });
        if (injury.flags[MODULE_ID]?.instant) return this.resolveInstant(actor, injury, { messageId });
        const data = game.items.fromCompendium(injury, { keepId: false });
        const [created] = await actor.createEmbeddedDocuments("Item", [data], { [MODULE_ID]: { damage, location, durations, messageId } });
        return created;
    }

    static async rollDurations(injury) {
        const durations = [];
        for (const effect of injury.effects) {
            const formula = effect.flags[MODULE_ID]?.duration?.formula;
            durations.push(formula ? (await new Roll(formula).evaluate()).total : null);
        }
        return durations;
    }

    static applyDurationsToText(html, injury, durations) {
        injury.effects.contents.forEach((effect, i) => {
            const formula = effect.flags[MODULE_ID]?.duration?.formula;
            if (!formula || !Number.isFinite(durations?.[i])) return;
            const escaped = formula.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\](\\s*(?:rounds?|turns?|days?|hours?|minutes?))`);
            html = html.replace(pattern, `<strong>${durations[i]}</strong>$1`);
        });
        return html;
    }

    static async onCreateItem(item, options) {
        if (!item.actor || !this.isInjury(item) || item.flags[MODULE_ID].resolved) return;
        if (item.flags[MODULE_ID].instant) {
            await this.resolveInstant(item.actor, item);
            return item.delete();
        }
        return this.resolve(item, options[MODULE_ID] ?? {});
    }

    static async resolveInstant(actor, injury, { messageId = null } = {}) {
        await this.runOnApply(actor, injury.flags[MODULE_ID].onApply, {});
        return this.postSummary(actor, injury, [], messageId);
    }

    static async resolve(item, { damage = null, location = null, durations = null, messageId = null }) {
        const flags = item.flags[MODULE_ID];
        const actor = item.actor;
        const needsDamage = flags.tiers?.length || flags.onApply?.maxHpFromDamage;
        if (needsDamage && !Number.isFinite(damage)) damage = await this.promptDamage(item.name);
        location ??= await this.rollLocation(flags.location);
        const tier = this.getTierFormula(flags.tiers, damage);
        if (!durations?.length) durations = await this.rollDurations(item);

        const durationLabels = [];
        const effectUpdates = [];
        for (const [i, effect] of item.effects.contents.entries()) {
            const effectFlags = effect.flags[MODULE_ID] ?? {};
            const update = { _id: effect.id };
            const spec = effectFlags.duration;
            if (spec) update.start = ActiveEffect.implementation.getEffectStart();
            if (spec?.formula && Number.isFinite(durations[i])) {
                update.duration = { value: durations[i], units: spec.units, expiry: spec.expiry ?? null };
                durationLabels.push(this.formatDuration(durations[i], spec.units));
            }
            if (effectFlags.ongoing && tier) {
                update[`flags.${MODULE_ID}.ongoing`] = effectFlags.ongoing.map((o) => ({ ...o, formula: o.formula.replace("@tier", tier) }));
            }
            if (flags.onApply?.maxHpFromDamage && effect === item.effects.contents[0]) {
                update["system.changes"] = [...effect.system.toObject().changes, { key: "system.attributes.hp.tempmax", type: "add", value: String(-Math.abs(damage)) }];
            }
            if (location) update.name = `${effect.name} (${location})`;
            effectUpdates.push(update);
        }

        await item.update({
            name: location ? `${item.name} (${location})` : item.name,
            "system.description.value": this.applyDurationsToText(item.system.description.value, item, durations),
            [`flags.${MODULE_ID}`]: { resolved: true, location, damage, tier },
        });
        if (effectUpdates.length) await item.updateEmbeddedDocuments("ActiveEffect", effectUpdates);
        await this.runOnApply(actor, flags.onApply, { damage });
        return this.postSummary(actor, item, durationLabels, messageId);
    }

    static formatDuration(value, units) {
        const plural = new Intl.PluralRules(game.i18n.lang).select(value);
        const label = game.i18n.localize(`mmm.units.${units}.${plural === "one" ? "one" : "other"}`);
        return `${value} ${label}`;
    }

    static async runOnApply(actor, onApply, { damage }) {
        if (!onApply) return;
        const updates = {};
        if (onApply.exhaustion) {
            const max = CONFIG.DND5E.conditionTypes.exhaustion?.levels ?? 6;
            updates["system.attributes.exhaustion"] = Math.min(max, (actor.system.attributes.exhaustion ?? 0) + onApply.exhaustion);
        }
        if (onApply.dropToZero) updates["system.attributes.hp.value"] = 0;
        if (onApply.loseInspiration) updates["system.attributes.inspiration"] = false;
        if (onApply.expendSlots) Object.assign(updates, this.getSlotUpdates(actor, onApply.expendSlots));
        if (!foundry.utils.isEmpty(updates)) await actor.update(updates);
        for (const status of onApply.statuses ?? []) await actor.toggleStatusEffect(status, { active: true });
        if (onApply.breakConcentration) await actor.endConcentration?.();
        if (onApply.unattune) {
            const attuned = actor.items.filter((i) => i.system.attuned).map((i) => ({ _id: i.id, "system.attuned": false }));
            if (attuned.length) await actor.updateEmbeddedDocuments("Item", attuned);
        }
    }

    static getSlotUpdates(actor, amount) {
        const spells = actor.system.spells ?? {};
        const slots = Object.entries(spells)
            .filter(([, slot]) => slot.max > 0)
            .map(([key, slot]) => ({ key, level: slot.level ?? (Number(key.replace("spell", "")) || 0), value: slot.value }));
        const updates = {};
        if (amount === "all") {
            for (const slot of slots) updates[`system.spells.${slot.key}.value`] = 0;
            return updates;
        }
        for (let i = 0; i < amount; i++) {
            const highest = slots.filter((s) => s.value > 0).sort((a, b) => b.level - a.level)[0];
            if (!highest) break;
            highest.value--;
            updates[`system.spells.${highest.key}.value`] = highest.value;
        }
        return updates;
    }

    static async postSummary(actor, item, durations, messageId = null) {
        const duration = durations.length ? durations.join(" / ") : game.i18n.localize(item.flags[MODULE_ID]?.instant ? "mmm.chat.instant" : "mmm.chat.untilTreated");
        const content = `<p>${game.i18n.format("mmm.chat.applied", { injury: item.toAnchor?.().outerHTML ?? item.name, actor: foundry.utils.escapeHTML(actor.name) })}</p><p><strong>${game.i18n.localize("mmm.chat.duration")}:</strong> ${duration}</p>`;
        const message = game.messages.get(messageId);
        if (message?.canUserModify(game.user, "update")) return message.update({ [`flags.${MODULE_ID}.applied`]: content });
        return ChatMessage.implementation.create({ content, speaker: ChatMessage.implementation.getSpeaker({ actor }) });
    }
}
