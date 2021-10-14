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
  for (let target of workflow.damageList) {
    const actor = game.actors.get(target.actorId);
    if(!actor.hasPlayerOwner) continue;
    const hpMax = actor.data.data.attributes.hp.max;
    const damageTaken = target.hpDamage;
    const isHalfOrMore = damageTaken >= hpMax / 2;
    const damageType = workflow.damageDetail[0].type;
    const save = workflow.saveDisplayData?.find((s) => s.id === target.tokenId);
    const isCritSave = save?.rollDetail?.terms[0]?.total === 1;
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
