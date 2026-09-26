import tokens from "./tokens.generated.json";

export type Scheme = "light" | "dark";
export type ThemePreference = "auto" | Scheme;
export type ColorName = keyof typeof tokens.colors.light;
export type TextVariant = keyof typeof tokens.text;

export const colors = tokens.colors as Record<Scheme, Record<ColorName, string>>;
export const colorChannels = tokens.colorChannels as Record<Scheme, Record<ColorName, string>>;
export const text = tokens.text;
export const size = tokens.size;
export const spacing = tokens.spacing;
export const radius = tokens.radius;
export const shadow = tokens.shadow;

/** Inter family per weight. React Native can't synthesise weights from one custom font file. */
export const fontFamilyForWeight: Record<string, string> = {
  "400": "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
};
