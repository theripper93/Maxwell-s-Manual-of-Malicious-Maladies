import { MODULE_ID } from "./main.js";
import { Injuries } from "./injuries.js";
import { getSetting } from "./settings.js";
import { Socket } from "./lib/socket.js";

export function registerAutomation() {
    Hooks.on("dnd5e.calculateDamage", onCalculateDamage);
    Hooks.on("dnd5e.applyDamage", onApplyDamage);
    Hooks.on("dnd5e.rollAttack", onRollAttack);
    Hooks.on("dnd5e.restCompleted", onRestCompleted);
    Hooks.on("combatTurnChange", onCombatTurnChange);
    Hooks.on("deleteActiveEffect", onDeleteActiveEffect);
}

function getInjuryEffects(actor) {
    return actor.items.filter((i) => Injuries.isInjury(i)).flatMap((i) => i.effects.filter((e) => !e.disabled && !isExpired(e)));
}

function isExpired(effect) {
    return effect._source.duration?.expired || effect.duration.expired;
}

function onCalculateDamage(actor, damages, options) {
    options[MODULE_ID] = { damages: damages.map((d) => ({ type: d.type, value: d.value })) };
}

function onApplyDamage(actor, amount, options) {
    if (amount <= 0) return;
    consumeEffects(actor, "damage");
    if (!actor.hasPlayerOwner && !getSetting("triggerNpc")) return;

    const damages = (options[MODULE_ID]?.damages ?? []).filter((d) => d.value > 0 && !(d.type in CONFIG.DND5E.healingTypes));
    const [highest] = damages.sort((a, b) => b.value - a.value);
    const tablename = highest?.type ?? null;
    const hp = actor.system.attributes.hp;
    const message = options.originatingMessage;
    const request = (reason) => Socket.requestRoll({ reason, tablename, uuid: actor.uuid, damage: amount });

    if (hp.value === 0 && getSetting("applyOnDown")) return request("mmm.reasons.downed");
    if (amount >= hp.effectiveMax * getSetting("damageThreshold") && getSetting("applyOnDamage")) return request("mmm.reasons.damage");
    if (getSetting("applyOnCrit") && message?.rolls?.some((r) => r.isCritical)) return request("mmm.reasons.crit");
    if (getSetting("applyOnCritSave") && hasFumbledSave(actor, message)) return request("mmm.reasons.critSave");
}

function hasFumbledSave(actor, damageMessage) {
    const origin = damageMessage?.getOriginatingMessage?.();
    if (!origin || origin === damageMessage) return false;
    return game.messages.contents.slice(-50).some((m) => {
        if (m === damageMessage || m.getOriginatingMessage?.()?.id !== origin.id) return false;
        const sameActor = actor.isToken ? m.speaker.token === actor.token.id : m.speaker.actor === actor.id;
        return sameActor && m.rolls.some((r) => r.isFumble);
    });
}

function onRollAttack(rolls, { subject }) {
    const actor = subject?.actor;
    if (actor?.isOwner) consumeEffects(actor, "attack");
}

async function consumeEffects(actor, event) {
    if (!actor.isOwner) return;
    for (const effect of getInjuryEffects(actor)) {
        const consume = effect.flags[MODULE_ID]?.consume;
        if (consume?.event !== event) continue;
        const uses = (consume.uses ?? 1) - 1;
        if (uses > 0) await effect.update({ [`flags.${MODULE_ID}.consume.uses`]: uses });
        else await effect.update({ "duration.expired": true });
    }
}

async function onRestCompleted(actor, result, config) {
    if (!actor.isOwner) return;
    const events = CONFIG.DND5E.restTypes[config.type ?? "long"]?.expiryEvents ?? [];
    for (const effect of getInjuryEffects(actor)) {
        if (events.includes(effect.duration.expiry)) await effect.update({ "duration.expired": true });
    }
}

async function onDeleteActiveEffect(effect, options, userId) {
    if (userId !== game.user.id || !isExpired(effect) || !getSetting("selfdestruct")) return;
    const item = effect.parent;
    if (!(item instanceof Item) || !item.actor || !Injuries.isInjury(item)) return;
    if (item.effects.some((e) => e.id !== effect.id && !isExpired(e))) return;
    if (item.actor.items.has(item.id)) await item.delete();
}

function onCombatTurnChange(combat, prior, current) {
    if (!game.users.activeGM?.isSelf) return;
    const forward = current.round > prior.round || (current.round === prior.round && current.turn > prior.turn);
    if (!forward) return;
    const ended = combat.combatants.get(prior.combatantId)?.actor;
    const started = combat.combatants.get(current.combatantId)?.actor;
    (async () => {
        if (ended) await processTurnEvent(ended, "turnEnd");
        if (started) await processTurnEvent(started, "turnStart");
    })();
}

async function processTurnEvent(actor, event) {
    for (const effect of getInjuryEffects(actor)) {
        const flags = effect.flags[MODULE_ID] ?? {};
        for (const ongoing of flags.ongoing ?? []) {
            if (ongoing.event === event) await runOngoing(actor, effect, ongoing);
        }
        if (flags.stack?.event === event) await advanceStack(effect, flags.stack);
    }
}

async function runOngoing(actor, effect, { formula, type }) {
    const speaker = ChatMessage.implementation.getSpeaker({ actor });
    if (type === "exhaustion") {
        const roll = await new Roll(formula.replace("@tier", "1")).evaluate();
        const max = CONFIG.DND5E.conditionTypes.exhaustion?.levels ?? 6;
        await actor.update({ "system.attributes.exhaustion": Math.min(max, (actor.system.attributes.exhaustion ?? 0) + roll.total) });
        return ChatMessage.implementation.create({ speaker, content: `<p>${game.i18n.format("mmm.chat.ongoingExhaustion", { injury: effect.name, levels: roll.total })}</p>` });
    }
    const roll = new CONFIG.Dice.DamageRoll(formula.replace("@tier", "1d4"), actor.getRollData(), { type });
    await roll.evaluate();
    const token = actor.token ?? actor.getActiveTokens(false, true)[0];
    await ChatMessage.implementation.create({
        type: "damage",
        speaker,
        flavor: game.i18n.format("mmm.chat.ongoingDamage", { injury: effect.name }),
        rolls: [roll],
        system: { targets: [{ actor: actor.uuid, token: token?.uuid ?? null, name: token?.name ?? actor.name, img: token?.texture?.src ?? actor.img, ac: actor.system.attributes.ac?.value ?? null }] },
    });
    if (getSetting("autoApplyOngoing")) await actor.applyDamage([{ value: roll.total, type }]);
}

async function advanceStack(effect, stack) {
    const count = Math.min((stack.count ?? 0) + 1, stack.max ?? Infinity);
    if (count === stack.count) return;
    const changes = stack.changes.map((c) => ({ ...c, value: String(Number(c.value) * count) }));
    await effect.update({ "system.changes": changes, [`flags.${MODULE_ID}.stack.count`]: count });
}
