// Theme comes ONLY from docs/design-tokens.json (via `npm run theme`).
// Default Tailwind colours, font sizes, spacing and radii are replaced, not extended,
// so a class that isn't a design token simply doesn't exist (CLAUDE.md hard rule 12).
const t = require("./src/theme/tokens.generated.json");

const map = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v, k)]));
const pxs = (obj) => map(obj, (v) => `${v}px`);

const sizes = {
  tap: t.size["tap-min"],
  "button-l": t.size["button-l"],
  "button-m": t.size["button-m"],
  "input-h": t.size["input-h"],
  "nozzle-row": t.size["nozzle-row-h"],
  "icon-inline": t.size["icon-inline"],
  "icon-nav": t.size["icon-nav"],
  content: t.size["content-max"],
  rail: t.size["rail-w"],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Our ThemeProvider switches colours itself (CSS variables per theme); NativeWind's own dark mode
  // isn't used. "class" stops NativeWind throwing when a browser adds a dark/light class to the page.
  darkMode: "class",
  theme: {
    colors: {
      transparent: "transparent",
      ...map(t.colors.light, (_v, name) => `rgb(var(--color-${name}) / <alpha-value>)`),
    },
    fontSize: map(t.text, (s) => [`${s.fontSize}px`, { lineHeight: `${s.lineHeight}px` }]),
    fontFamily: {
      sans: ["Inter_400Regular"],
      medium: ["Inter_500Medium"],
      semibold: ["Inter_600SemiBold"],
    },
    spacing: { 0: "0px", px: "1px", ...pxs(t.spacing), ...pxs(sizes) },
    borderRadius: { none: "0px", ...pxs(t.radius) },
    extend: {
      borderWidth: { 1.5: "1.5px" },
      maxWidth: { content: `${t.size["content-max"]}px` },
    },
  },
  plugins: [],
};
