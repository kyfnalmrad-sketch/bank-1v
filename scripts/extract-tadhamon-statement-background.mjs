import { readFile, writeFile } from "node:fs/promises";
const source = await readFile("/home/ubuntu/upload/local-tadhamon-ycb-refined-updated.html", "utf8");
const match = source.match(/data:image\/png;base64,([^')"]+)/);
if (!match) throw new Error("Embedded Tadhamon statement background not found");
await writeFile("client/public/assets/tadhamon-statement-background-updated.png", Buffer.from(match[1], "base64"));
console.log(`extracted ${match[1].length} base64 characters`);
