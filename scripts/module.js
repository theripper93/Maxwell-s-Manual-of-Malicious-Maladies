Hooks.on("midi-qol.RollComplete", async (workflow) => {
  let timeout = 0;
  while(!workflow.damageList && timeout < 100) {
    await MaxwelMaliciousMaladies.sleep(500);
    timeout++;
  }
  if(!workflow.damageList) return;
  const applyOnCritSave = game.settings.get("mmm", "applyOnCritSave");
  const applyOnCrit = game.settings.get("mmm", "applyOnCrit");
  const applyOnDamage = game.settings.get("mmm", "applyOnDamage");
  const applyOnDown = game.settings.get("mmm", "applyOnDown");
  const triggerNpc = game.settings.get("mmm", "triggerNpc");
  for (let target of workflow.damageList) {
    const actor = game.actors.get(target.actorId);
    if(!actor.hasPlayerOwner && !triggerNpc) continue;
    const hpMax = actor.data.data.attributes.hp.max;
    const damageTaken = target.hpDamage;
    const isHalfOrMore = damageTaken >= hpMax / 2;
    const damageType = workflow.damageDetail[0].type;
    const save = workflow.saveDisplayData?.find((s) => s.id === target.tokenId);
    const isCritSave = save?.rollDetail?.terms[0]?.results?.find(result => result.active)?.result === 1;
    const isCrit = workflow.isCritical;
    const isDead = target.newHP <= 0;
    if (isHalfOrMore && applyOnDamage) {
      MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll",
        "Damage exeded half of maximum hp",
        damageType,
        actor.id
      );
      continue;
    }
    if (isCritSave && applyOnCritSave) {
      MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll",
        "Fumbled saving throw",
        damageType,
        actor.id
      );
      continue;
    }
    if (isCrit && applyOnCrit) {
      MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll","Critical hit", damageType, actor.id);
      continue;
    }
    if (isDead && applyOnDown) {
      MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll","Downed", damageType, actor.id);
      continue;
    }
  }
});

Hooks.on("preUpdateActor", (actor,updates)=>{updates.prevHp = actor.data.data.attributes.hp.value});

Hooks.on("updateActor", (actor, updates)=>{
  if(!game.user.isGM || updates.damageItem || updates?.data?.attributes?.hp?.value === undefined) return;
  const triggerNpc = game.settings.get("mmm", "triggerNpc");
  if(!actor.hasPlayerOwner && !triggerNpc) return;
  if(!game.settings.get("mmm", "nonMidiAutomation")) return;
  const applyOnDamage = game.settings.get("mmm", "applyOnDamage");
  const applyOnDown = game.settings.get("mmm", "applyOnDown");
  const hpMax = actor.data.data.attributes.hp.max;
  const damageTaken = actor.data.data.attributes.hp.value - updates.prevHp;
  if(damageTaken >= 0) return;
  const isHalfOrMore = Math.abs(damageTaken) >= hpMax / 2;
  const isDead = actor.data.data.attributes.hp.value <= 0;
  if (isHalfOrMore && applyOnDamage) {
    MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll",
      "Damage exeded half of maximum hp",
      undefined,
      actor.id
    );
    return;
  }
  if (isDead && applyOnDown) {
    MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll","Downed", undefined, actor.id);
    return;
  }
})