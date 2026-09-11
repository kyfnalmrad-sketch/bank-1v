import { readFile, writeFile } from "node:fs/promises";
const source = await readFile(new URL("../docs/reference/tadhamon/local-tadhamon-ycb-refined.html", import.meta.url), "utf8");
const match = source.match(/data:image\/png;base64,([^')"]+)/);
if (!match) throw new Error("Tadhamon background base64 was not found");
await writeFile(new URL("../client/public/assets/tadhamon-statement-background.png", import.meta.url), Buffer.from(match[1], "base64"));
console.log("extracted Tadhamon background", match[1].length);
