class MaxwelMaliciousMaladies {
  static async rollTable(name, actor){
    name = name.trim();
    if(!name.endsWith("[MMMM]")) name = name + " - [MMMM]";
    name = name.charAt(0).toUpperCase() + name.slice(1);
    const table = game.tables.getName(name) ?? await this.getTableFromPack(name);
    if(!table) return await this.displayDialog();
    let chatMessage
    Hooks.once("createChatMessage", (message) =>{
      chatMessage = message;
    })
    const result = await table.draw()
    this.rollSubtable(result.results[0].text, chatMessage);
    return result
  }

  static async rollSubtable(result, chatMessage){
    const subTables = ["Scar Chart", "Small Appendage Table", "Large Limb Table"];
    for(let tab of subTables){
      if(result.toLowerCase().includes(tab.toLowerCase())){
        const result = await MaxwelMaliciousMaladies.rollTable(tab);
        const text = result.results[0].text
        MaxwelMaliciousMaladies.insertSubtableResult(text,chatMessage)
        return;
      }
    }
  }

  static async insertSubtableResult(text, chatMessage){
    const content = $(chatMessage.content)
    const result = content.find(".result-text")
    //find replace the text in the first stron tag
    const oldTitle = result.find("strong").first().text()
    const newContent = chatMessage.content.replace(oldTitle, oldTitle + "(" + text + ")")
    chatMessage.update({
      content: newContent
    })
  }


  static getPack(){
    return game.packs.get("mmm.mmmm");
  }

  static async getTableFromPack(name){
    const pack = this.getPack();
    const entry = Array.from(pack.index).find(e => e.name == name);
    return await pack.getDocument(entry._id);
  }

  static async displayDialog(){
    let select = `<div class="form-group"><select style="width: 100%;" id="mmm-select-table">`;
    const pack = this.getPack();
    const tableNames = Array.from(pack.index).map(e => e.name.replace(" - [MMMM]", ""));
    tableNames.forEach(name => select+=`<option value="${name}">${name}</option>`);
    select += `</select></div><p>`;
    new Dialog({
      title: "Maxwell's Manual of Malicious Maladies",
      content: `<p>Chose a Table:</p>${select}`,
      buttons: {
       one: {
        icon: '<i class="fas fa-dice-d20"></i>',
        label: "Roll Injury",
        callback: (html) => {
          const tableName = html.find("#mmm-select-table")[0].value;
          MaxwelMaliciousMaladies.rollTable(tableName);
        }
       },
       two: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
        callback: () => {}
       }
      },
     }).render(true);

  }

  static async confirmInjury(reason, tablename, actor){
    //set first letter to upper case
    const choseTable = !tablename
    const damage = choseTable ? "" : tablename.charAt(0).toUpperCase() + tablename.slice(1);
    let select = "";
    let rollPrompt = choseTable ? `Select the correct <strong>Damage Type</strong> before rolling on the table.` : `Roll on the <strong>${damage} Damage</strong> table?`;
    if(choseTable){
      select = `<div class="form-group"><select style="width: 100%;" id="mmm-select-table">`;
      const pack = this.getPack();
      const tableNames = Array.from(pack.index).map(e => e.name.replace(" - [MMMM]", ""));
      tableNames.forEach(name => select+=`<option value="${name}">${name}</option>`);
      select += `</select></div><p>`;
    }
    new Dialog({
      title: "Maxwell's Manual of Malicious Maladies",
      content: `<p>${actor.name} sustained a lingering injury.<br>Reason: <strong>${reason}</strong>.<br>${rollPrompt}</p>${select}`,
      buttons: {
       one: {
        icon: '<i class="fas fa-dice-d20"></i>',
        label: "Roll Injury",
        callback: (html) => {
          const token = actor.getActiveTokens()
          token[0]?.control()
          if(choseTable){
            tablename = html.find("#mmm-select-table")[0].value;
          }
          MaxwelMaliciousMaladies.rollTable(tablename,actor);
        }
       },
       two: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
        callback: () => {}
       }
      },
     }).render(true);
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static inferDuration(text){
    const seconds = parseInt(text.match(/\d+ second/i)) || 0;
    const minutes = parseInt(text.match(/\d+ minute/i)) || 0;
    const hours = parseInt(text.match(/\d+ hour/i)) || 0;
    const days = parseInt(text.match(/\d+ day/i)) || 0;
    //add up
    return seconds + (minutes * 60) + (hours * 60 * 60) + (days * 60 * 60 * 24);
  }

  static isOwnerConnected(actor){
    for(let [userId,permission] of Object.entries(actor.ownership)){
      if(permission !== 3) continue;
      const user = game.users.get(userId);
      if(!user?.isGM && user?.active) return true;
    }
    return false;
  }

  static requestRoll(reason, tablename, actorId){
    const actor = game.actors.get(actorId);
    if(game.user.isGM){
      if(!MaxwelMaliciousMaladies.isOwnerConnected(actor)) MaxwelMaliciousMaladies.confirmInjury(reason, tablename, actor);
      return;
    }
    if(actor.isOwner && MaxwelMaliciousMaladies.isOwnerConnected(actor)) MaxwelMaliciousMaladies.confirmInjury(reason, tablename, actor);
  }
}