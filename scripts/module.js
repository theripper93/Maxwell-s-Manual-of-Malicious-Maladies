Hooks.on("midi-qol.RollComplete", async (workflow) => {
    let timeout = 0;
    if (!workflow.item?.hasDamage || workflow.hitTargets.size === 0) return;
    while (!workflow.damageList && timeout < 100) {
        await MaxwelMaliciousMaladies.sleep(500);
        timeout++;
    }
    if (!workflow.damageList) return;
    const applyOnCritSave = game.settings.get("mmm", "applyOnCritSave");
    const applyOnCrit = game.settings.get("mmm", "applyOnCrit");
    const applyOnDamage = game.settings.get("mmm", "applyOnDamage");
    const triggerNpc = game.settings.get("mmm", "triggerNpc");
    for (let target of workflow.damageList) {
        const token = await fromUuid(target.tokenUuid);
        const actor = token.actor;
        const applyOnDown = game.settings.get("mmm", "applyOnDown") && actor.hasPlayerOwner;
        if (!actor.hasPlayerOwner && !triggerNpc) continue;
        const hpMax = actor.system.attributes.hp.max;
        const damageTaken = target.hpDamage;
        const isHalfOrMore = damageTaken >= hpMax / 2;
        const damageType = workflow.damageDetail[0].type;
        const save = workflow.saveDisplayData?.find((s) => s.id === target.tokenId);
        const isCritSave = save?.rollDetail?.terms[0]?.results?.find((result) => result.active)?.result === 1;
        const isCrit = workflow.isCritical;
        const isDead = target.newHP <= 0;
        if (isHalfOrMore && applyOnDamage) {
            MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Damage exeded half of maximum hp", damageType, actor.uuid);
            continue;
        }
        if (isCritSave && applyOnCritSave) {
            MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Fumbled saving throw", damageType, actor.uuid);
            continue;
        }
        if (isCrit && applyOnCrit) {
            MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Critical hit", damageType, actor.uuid);
            continue;
        }
        if (isDead && applyOnDown) {
            MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Downed", damageType, actor.uuid);
            continue;
        }
    }
});

Hooks.on("preUpdateActor", (actor, updates, diff) => {
    diff.prevHp = actor.system.attributes.hp.value;
});

Hooks.on("updateActor", (actor, updates, diff) => {
    if (!game.user.isGM || updates.damageItem || updates?.system?.attributes?.hp?.value === undefined) return;
    const triggerNpc = game.settings.get("mmm", "triggerNpc");
    if (!actor.hasPlayerOwner && !triggerNpc) return;
    if (!game.settings.get("mmm", "nonMidiAutomation")) return;
    const applyOnDamage = game.settings.get("mmm", "applyOnDamage");
    const applyOnDown = game.settings.get("mmm", "applyOnDown") && actor.hasPlayerOwner;
    const hpMax = actor.system.attributes.hp.max;
    const damageTaken = actor.system.attributes.hp.value - diff.prevHp;
    if (damageTaken >= 0) return;
    const isHalfOrMore = Math.abs(damageTaken) >= hpMax / 2;
    const isDead = actor.system.attributes.hp.value <= 0;
    if (isHalfOrMore && applyOnDamage) {
        MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Damage exeded half of maximum hp", undefined, actor.uuid);
        return;
    }
    if (isDead && applyOnDown) {
        MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Downed", undefined, actor.uuid);
        return;
    }
});
