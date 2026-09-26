export function buildTheme(tokens: unknown): {
  colors: { light: Record<string, string>; dark: Record<string, string> };
  colorChannels: { light: Record<string, string>; dark: Record<string, string> };
  text: Record<string, { fontSize: number; lineHeight: number; fontWeight: string }>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  size: Record<string, number>;
  shadow: Record<string, { light: string; dark: string }>;
};
export function hexToChannels(hex: string): string;
