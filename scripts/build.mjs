// Frankenguard build: inline src/ modules + app.js into dist/index.html.
// No dependencies, deterministic output: same source, same bytes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist");
mkdirSync(outDir, { recursive: true });

const INLINE = [
  { tag: '<script src="../src/engine.js"></script>', file: "src/engine.js" },
  { tag: '<script src="../src/parser.js"></script>', file: "src/parser.js" },
  { tag: '<script src="../src/ledger.js"></script>', file: "src/ledger.js" },
  { tag: '<script src="app.js"></script>', file: "app/app.js" },
];

let html = readFileSync(join(root, "app/index.html"), "utf8");
for (const item of INLINE) {
  if (!html.includes(item.tag)) {
    console.error("build failed: tag not found: " + item.tag);
    process.exit(1);
  }
  const code = readFileSync(join(root, item.file), "utf8").replace(/<\/script/gi, "<\\/script");
  // Replacer function, not a string: the code contains $ sequences
  // ($', $&) that String.replace would otherwise interpret.
  html = html.replace(item.tag, () => "<script>\n" + code + "\n</script>");
}

if (/<script\s+src=/.test(html)) {
  console.error("build failed: external <script src> remains after inlining");
  process.exit(1);
}

const outPath = join(outDir, "index.html");
writeFileSync(outPath, html);
const hash = createHash("sha256").update(html, "utf8").digest("hex");
console.log("built " + outPath + " (" + Buffer.byteLength(html) + " bytes, sha256 " + hash.slice(0, 16) + "…)");
