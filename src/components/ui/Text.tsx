import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { fontFamilyForWeight, text, type TextVariant } from "@/theme/theme";

export type TextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "accent"
  | "accentStrong"
  | "danger"
  | "warning"
  | "success"
  | "onPrimary"
  | "onDanger"
  | "onSuccess"
  | "inverse"
  | "hsd"
  | "ms";

const toneClass: Record<TextTone, string> = {
  primary: "text-text-primary",
  secondary: "text-text-secondary",
  muted: "text-text-muted",
  accent: "text-primary",
  accentStrong: "text-primary-hover",
  danger: "text-danger",
  warning: "text-warning",
  success: "text-success",
  onPrimary: "text-on-primary",
  onDanger: "text-on-danger",
  onSuccess: "text-on-success",
  inverse: "text-bg",
  hsd: "text-hsd",
  ms: "text-ms",
};

const variantClass: Record<TextVariant, string> = {
  display: "text-display",
  title: "text-title",
  heading: "text-heading",
  body: "text-body",
  label: "text-label",
  caption: "text-caption",
  "number-input": "text-number-input",
  "number-inline": "text-number-inline",
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Overrides the variant's weight. Inter ships 400, 500 and 600 only. */
  weight?: "400" | "500" | "600";
  /** Slashed zero, for vehicle numbers, so 0 never reads as O. */
  slashedZero?: boolean;
  className?: string;
};

/**
 * All text in the app. Every number uses tabular figures so columns of digits line up.
 * Colour comes only from `tone` (theme tokens).
 */
export function Text({
  variant = "body",
  tone = "primary",
  weight,
  slashedZero,
  className = "",
  style,
  ...rest
}: TextProps) {
  const fontFamily = fontFamilyForWeight[weight ?? text[variant].fontWeight];
  return (
    <RNText
      className={`${variantClass[variant]} ${toneClass[tone]} ${className}`}
      style={[
        { fontFamily, fontVariant: ["tabular-nums"] },
        slashedZero ? ({ fontFeatureSettings: "'tnum', 'zero'" } as object) : null,
        style,
      ]}
      {...rest}
    />
  );
}
