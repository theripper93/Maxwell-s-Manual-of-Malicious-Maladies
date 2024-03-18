Hooks.on("dnd5e.calculateDamage", (actor, damages, o) => {
  
	o.MMMMID = randomID();

	Hooks.once("dnd5e.applyDamage", (a, b, options) => {

		if(o.MMMMID !== options.MMMMID) return;

		const triggerNpc = game.settings.get("mmm", "triggerNpc");
		if (!actor.hasPlayerOwner && !triggerNpc) return;
		damages = [...damages];
		damages.forEach((d) => {
			if (!d.type) d.type = d.value < 0 ? "healing" : "";
		});
		const damagesNoHealing = damages.filter((d) => d.type !== "healing");
		if (!damagesNoHealing.length) return;
		const damagesSorted = damagesNoHealing.sort((a, b) => b.value - a.value);
		const highestDamageType = damagesSorted[0].type;
		const totalDamage = damagesSorted.reduce((acc, d) => acc + d.value, 0);
	
		const hpMax = actor.data.data.attributes.hp.max;
		const hpCurrent = actor.data.data.attributes.hp.value;
		const isHalfOrMore = totalDamage >= hpMax / 2;
		const isDead = hpCurrent === 0;
		const isCrit = options?.midi?.isCritical;
		const isCritSave = options?.midi?.fumbleSave;
		if (isDead && actor.hasPlayerOwner && game.settings.get("mmm", "applyOnDown")) {
			MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Downed", highestDamageType, actor.uuid);
			return;
		}
		if (isHalfOrMore && game.settings.get("mmm", "applyOnDamage")) {
			MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Damage exeded half of maximum hp", highestDamageType, actor.uuid);
			return;
		}
		if(isCrit && game.settings.get("mmm", "applyOnCrit")){
			MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Critical Hit", highestDamageType, actor.uuid);
			return;
		}
		if(isCritSave && game.settings.get("mmm", "applyOnCritSave")){
			MaxwelMaliciousMaladiesSocket.executeForEveryone("requestRoll", "Fumbled Saving Throw", highestDamageType, actor.uuid);
			return;
		}
	});
});
