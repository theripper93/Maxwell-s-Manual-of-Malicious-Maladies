import "../scss/module.scss";
import { MaxwelMaliciousMaladies } from "./maxwelMaliciousMaladies.js";
import { Injuries } from "./injuries.js";
import { registerAutomation } from "./automation.js";
import { registerSettings } from "./settings.js";
import { Socket } from "./lib/socket.js";

export const MODULE_ID = "mmm";

Hooks.once("init", () => {
    registerSettings();
    Socket.register("requestRoll", MaxwelMaliciousMaladies.requestRoll);
    game.modules.get(MODULE_ID).api = { MaxwelMaliciousMaladies, Injuries };
});

Hooks.once("ready", () => {
    registerAutomation();
});

Hooks.on("chatMessage", (chatLog, content) => {
    const div = document.createElement("div");
    div.innerHTML = content;
    const text = div.innerText.trim();
    if (!text.toLowerCase().startsWith("/mmmm")) return;
    const tableName = text.slice(5).trim();
    if (tableName) MaxwelMaliciousMaladies.rollTable(tableName);
    else MaxwelMaliciousMaladies.displayDialog();
    return false;
});

Hooks.on("renderChatMessageHTML", (message, html) => MaxwelMaliciousMaladies.onRenderChatMessage(message, html));

Hooks.on("createItem", (item, options, userId) => {
    if (userId !== game.user.id) return;
    Injuries.onCreateItem(item, options);
});
