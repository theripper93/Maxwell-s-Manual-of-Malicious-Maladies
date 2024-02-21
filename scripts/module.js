Hooks.on("dnd5e.calculateDamage", (actor, damages) => {
    const triggerNpc = game.settings.get("mmm", "triggerNpc");
    if (!actor.hasPlayerOwner && !triggerNpc) return;
    damages = [...damages];
    damages.forEach(d => {
      if(!d.type) d.type = d.value < 0 ? "healing" : "";
    });
    const damagesNoHealing = damages.filter(d => d.type !== "healing");
    if(!damagesNoHealing.length) return;
    const damagesSorted = damagesNoHealing.sort((a, b) => b.value - a.value);
    const highestDamageType = damagesSorted[0].type;
    const totalDamage = damagesSorted.reduce((acc, d) => acc + d.value, 0);
    
    const hpMax = actor.data.data.attributes.hp.max;
    const hpCurrent = actor.data.data.attributes.hp.value;
    const isHalfOrMore = totalDamage >= hpMax / 2;
    const isDead = hpCurrent === 0;
    const applyOnDamage = game.settings.get("mmm", "applyOnDamage");
    const applyOnDown = game.settings.get("mmm", "applyOnDown") && actor.hasPlayerOwner;
    if (isDead && applyOnDown) {
        MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Downed", highestDamageType, actor.uuid);
        return;
    }
    if (isHalfOrMore && applyOnDamage) {
        MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Damage exeded half of maximum hp", highestDamageType, actor.uuid);
        return;
    }
  });