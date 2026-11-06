import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";

const PACKS = ["tables", "items", "journals", "injuries"];
const SOURCE = "src/packs";
const OUTPUT = "packs";

const mode = process.argv[2];

for (const pack of PACKS) {
    const src = path.join(SOURCE, pack);
    const out = path.join(OUTPUT, pack);
    if (mode === "build") {
        if (!fs.existsSync(src)) continue;
        fs.rmSync(out, { recursive: true, force: true });
        await compilePack(src, out, { log: false, recursive: true });
        console.log(`Built ${out}`);
    } else if (mode === "extract") {
        if (!fs.existsSync(out)) continue;
        await extractPack(out, src, { log: false, clean: true, transformName });
        console.log(`Extracted ${src}`);
    } else {
        throw new Error("Usage: node tools/packs.mjs <build|extract>");
    }
}

function transformName(doc) {
    const name = (doc.name ?? "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
    return `${name || doc._id}_${doc._id}.json`;
}
