// Turns docs/design-tokens.json (exported from Claude Design) into the app theme.
// Pure function so the test can check the committed output is up to date.

const px = (v) => {
  const n = Number(String(v).replace("px", ""));
  if (!Number.isFinite(n)) throw new Error(`Not a px value: ${v}`);
  return n;
};

const strip = (prefix, name) => name.replace(new RegExp(`^${prefix}-`), "");

export function buildTheme(tokens) {
  const colors = { light: {}, dark: {} };
  for (const t of tokens.color.tokens) {
    const name = strip("color", t.name);
    colors.light[name] = t.value.light.toUpperCase();
    colors.dark[name] = t.value.dark.toUpperCase();
  }

  const text = {};
  for (const group of tokens.type.groups) {
    for (const s of group.styles) {
      text[s.name] = {
        fontSize: px(s.fontSize),
        lineHeight: px(s.lineHeight),
        fontWeight: String(s.fontWeight),
      };
    }
  }

  const spacing = {};
  for (const t of tokens.spacing.tokens) spacing[strip("space", t.name)] = px(t.value);

  const radius = {};
  for (const t of tokens.radius.tokens) radius[strip("radius", t.name)] = px(t.value);

  const size = {};
  for (const t of tokens.size.tokens) size[t.name] = px(t.value);

  const shadow = {};
  for (const t of tokens.shadow.tokens) shadow[strip("shadow", t.name)] = t.value;

  // Same colours as "r g b" channels, the format NativeWind CSS variables need.
  const colorChannels = {
    light: Object.fromEntries(Object.entries(colors.light).map(([k, v]) => [k, hexToChannels(v)])),
    dark: Object.fromEntries(Object.entries(colors.dark).map(([k, v]) => [k, hexToChannels(v)])),
  };

  return { colors, colorChannels, text, spacing, radius, size, shadow };
}

/** "#0F766E" -> "15 118 110", the format NativeWind CSS variables need. */
export function hexToChannels(hex) {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Bad hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}
