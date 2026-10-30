// Fails when src/ breaks the look rules in docs/design.md: hardcoded colors,
// hardcoded font families, `dark:` classes and fill-colour text. The look lives in
// src/app/theme.css; the QR code is black on white by necessity. The hard
// shadow belongs to things you press, so only the pressable controls may use it.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "src");
const exempt = new Set([
  "app/theme.css",
  "components/QrCode.tsx",
  "api/database.types.ts",
]);

const rules = [
  ["a hex color", /#[0-9a-f]{3,8}\b(?![\w-])/i],
  ["an rgb()/hsl()/oklch() color", /\b(?:rgba?|hsla?|oklch)\(/i],
  [
    "a hardcoded font family",
    /font-family\s*:|fontFamily\s*:|font-\[|["'](?:Arial|Helvetica|Inter|Geist)\b/,
  ],
  ["a dark: class", /(?:^|[\s"'`])dark:/],
  [
    "text-destructive or text-danger (use ErrorLine / text-danger-text)",
    /(?<![\w-])text-(?:destructive|danger)(?![\w-])/,
  ],
];

// The pressable controls that may wear the hard offset shadow (shadow-pop-sm).
// Add a file here when you build a new pressable control.
const pressables = new Set([
  "components/ui/button.tsx",
  "components/ui/switch.tsx",
  "modules/ChoiceTile.tsx",
  "views/create/ChoiceButton.tsx",
]);
const hardShadow = /(?<![\w-])shadow-pop-(?:sm|md|lg)\b/;

function* sourceFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (
      /\.(ts|tsx|css)$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      yield full;
    }
  }
}

const found = [];
for (const file of sourceFiles(root)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (exempt.has(rel)) continue;
  fs.readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (!pressables.has(rel) && hardShadow.test(line)) {
        found.push(
          `src/${rel}:${i + 1}: a hard shadow on something you can't press: ${line.trim()}`,
        );
      }
      for (const [name, pattern] of rules) {
        if (pattern.test(line)) {
          found.push(`src/${rel}:${i + 1}: ${name}: ${line.trim()}`);
        }
      }
    });
}

if (found.length > 0) {
  console.error(
    `Design rules broken (see docs/design.md):\n${found.join("\n")}`,
  );
  process.exit(1);
}
console.log(
  "Design rules hold: no hardcoded colors, fonts or dark: classes, and hard shadows only on pressables.",
);
