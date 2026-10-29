// Reports relative links in README.md and docs/README.md that point to files or
// folders that do not exist. Run by hand with `npm run check:links`. Not part of CI.
// External links (http, mailto) and in-page anchors are ignored.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = ["README.md", "docs/README.md"];
const linkPattern = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/[^\n]/g, " "),
  );
}

function brokenLinks(file) {
  const text = stripCode(readFileSync(file, "utf8"));
  const broken = [];
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1];
    if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    const path = decodeURIComponent(target.split(/[#?]/)[0]);
    if (!path) continue;
    const base = path.startsWith("/") ? process.cwd() : dirname(resolve(file));
    if (!existsSync(resolve(base, path.replace(/^\//, "")))) {
      const line = text.slice(0, match.index).split("\n").length;
      broken.push({ line, target });
    }
  }
  return broken;
}

let problems = 0;
for (const file of files) {
  if (!existsSync(file)) {
    console.log(`${file}: not found, skipped`);
    continue;
  }
  for (const { line, target } of brokenLinks(file)) {
    console.log(`${file}:${line}: missing ${target}`);
    problems++;
  }
}
console.log(
  problems === 0 ? "No broken links." : `${problems} broken link(s).`,
);
process.exit(problems === 0 ? 0 : 1);
