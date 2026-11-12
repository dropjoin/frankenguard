// Frankenguard static verifier: title, secrets, inlining, honesty labels.
// Run after `npm run build`. Exits non-zero on the first failed check.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;

function check(name, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
  if (!ok) failures++;
}

const distPath = join(root, "dist/index.html");
let dist;
try {
  dist = readFileSync(distPath, "utf8");
} catch {
  console.error("FAIL  dist/index.html missing: run `npm run build` first");
  process.exit(1);
}

// 1. Title: present, no em dash.
const titleMatch = dist.match(/<title>([\s\S]*?)<\/title>/);
check("title present", !!titleMatch);
if (titleMatch) {
  check("title has no em dash", !titleMatch[1].includes("—"), titleMatch[1]);
}
// 2. No em dash anywhere in the deployed copy.
check("no em dash in dist copy", !dist.includes("—"));
// 3. All scripts inlined.
check("no external <script src>", !/<script\s+src=/.test(dist));
// 4. Engine globals present.
for (const g of ["FrankenguardEngine", "FrankenguardParser", "FrankenguardLedger"]) {
  check("global present: " + g, dist.includes(g));
}
// 5. Honesty labels present.
for (const label of [
  "No real money moves",
  "fictional",
  "not an LLM",
  "UTC midnight",
  "stays in your browser",
]) {
  check("honesty label present: " + label, dist.includes(label));
}
// 6. No placeholders or leftover markers.
for (const marker of ["TODO", "FIXME", "XXX", "lorem ipsum", "Lorem ipsum"]) {
  check("no marker: " + marker, !dist.includes(marker));
}
// 7. No dangerous sinks in the shipped file.
check("no document.write", !dist.includes("document.write"));
check("no eval(", !/eval\s*\(/.test(dist));
// 8. Screenshot mode present.
check("?shot=1 mode present", dist.includes('"shot"') && dist.includes("classList.add"));
// 9. Secret scan across the whole tree (excluding .git and node_modules).
const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9]{20,}/,
  /gho_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/,
  /PRIVATE_KEY\s*[:=]\s*["'][^"']{10,}/,
  /api[_-]?key\s*[:=]\s*["'][^"']{10,}/i,
  /password\s*[:=]\s*["'][^"']{8,}/i,
];
function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (entry === ".git" || entry === "node_modules") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if ([".js", ".mjs", ".html", ".json", ".md", ".py"].includes(extname(p))) out.push(p);
  }
  return out;
}
let secretHits = [];
for (const file of walk(root, [])) {
  const content = readFileSync(file, "utf8");
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) secretHits.push(file + " :: " + pattern);
  }
}
check("secret scan clean", secretHits.length === 0, secretHits.join("; "));
// 10. No .env files tracked.
check("no .env files", walk(root, []).filter((f) => f.endsWith(".env")).length === 0);

console.log(failures === 0 ? "\nverify: all checks passed" : "\nverify: " + failures + " check(s) failed");
process.exit(failures === 0 ? 0 : 1);
