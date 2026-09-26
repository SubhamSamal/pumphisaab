// Run: npm run theme
// Regenerates src/theme/tokens.generated.json from docs/design-tokens.json.
import { readFileSync, writeFileSync } from "node:fs";
import { buildTheme } from "./theme.mjs";

const tokens = JSON.parse(readFileSync("docs/design-tokens.json", "utf8"));
const out = JSON.stringify(buildTheme(tokens), null, 2) + "\n";
writeFileSync("src/theme/tokens.generated.json", out);
console.log("Wrote src/theme/tokens.generated.json");
