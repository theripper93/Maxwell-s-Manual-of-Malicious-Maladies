Hooks.once('init', function() {

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

Hooks.once('ready', async function() {

});

Hooks.on("chatMessage", (ChatLog, content) => {
    if (content.toLowerCase().startsWith("/mmmm")) {
      const data = content.replace("/mmmm", "").trim();
      if(data){
        MaxwelMaliciousMaladies.rollTable(data);
      }else{
        MaxwelMaliciousMaladies.displayDialog();
      }

      return false;
    }
  });

Hooks.on("renderChatMessage", (message, html)=>{
    if(!game.user.isGM || !message?.flavor?.includes("[MMMM]")) return;
    const subTables = ["Scar Chart", "Small Appendage Table", "Large Limb Table"];
    for(let t of subTables){
      if(message?.flavor?.includes(t)) return;
    }
    const button = $(`<a title="Apply Lingering Injury" style="margin-right: 0.3rem;color: red;" class="button"><i class="fas fa-viruses"></i></a>`)
    html.find(".result-text").prepend(button)
    button.on("click", async (e)=>{
        e.preventDefault();
        let actor = game.scenes.get(message?.speaker?.scene)?.tokens?.get(message?.speaker?.token)?.actor;
        actor = actor ?? (game.actors.get(message?.speaker?.actor) ?? _token?.actor);
        if(!actor) return ui.notifications.error("No token selected or actor found!");
        const content = $(message.content)
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
              mmm: 
              {
                lingeringInjury: true
              }
            },
            "effects": [
              {
                icon: imgsrc,
                label: title,
                transfer: true,
                changes: [
                  {
                    "key": "flags.dae.deleteOrigin",
                    "value":  game.settings.get("mmm", "selfdestruct") ? 1 : "",
                    "mode": 2,
                    "priority": 0
                  }
                ],
                duration: {
                  seconds: title.includes("(") ? null : duration || 9999999999,
                },
                description: description,
                flags: {
                  mmm: 
                  {
                    lingeringInjury: true
                  },
                },
              }
            ],
        }
        actor.createEmbeddedDocuments("Item", [itemData]);
        ui.notifications.notify(`Added ${title} to ${actor.name}`)
    });
});

let MaxwelMaliciousMaladiesSocket;

Hooks.once("socketlib.ready", () => {
  MaxwelMaliciousMaladiesSocket = socketlib.registerModule("mmm");
  MaxwelMaliciousMaladiesSocket.register("requestRoll", MaxwelMaliciousMaladies.requestRoll);
});