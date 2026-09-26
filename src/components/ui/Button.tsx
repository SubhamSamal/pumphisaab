import { ActivityIndicator, Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { ColorName } from "@/theme/theme";
import { Icon, type IconName } from "./Icon";
import { Text, type TextTone } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const box: Record<ButtonVariant, string> = {
  primary: "bg-primary border-primary",
  secondary: "bg-bg border-primary",
  ghost: "bg-transparent border-transparent",
  destructive: "bg-danger border-danger",
};
const label: Record<ButtonVariant, TextTone> = {
  primary: "onPrimary",
  secondary: "accent",
  ghost: "accent",
  destructive: "onDanger",
};
const iconColor: Record<ButtonVariant, ColorName> = {
  primary: "on-primary",
  secondary: "primary",
  ghost: "primary",
  destructive: "on-danger",
};

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** L (56 px) is the one primary action per screen, in the sticky bar. M (44 px) sits in cards and banners. */
  size?: "L" | "M";
  icon?: IconName;
  disabled?: boolean;
  /** Keeps the label ("Saving…"), shows a spinner and blocks taps. */
  loading?: boolean;
  /** M only: sits at the start of its column by default; `center` for empty states. */
  align?: "start" | "center";
};

export function Button({ label: text, onPress, variant = "primary", size = "L", icon, disabled, loading, align = "start" }: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const boxClass = disabled ? "bg-auto-field-bg border-auto-field-bg" : box[variant];
  const tone: TextTone = disabled ? "muted" : label[variant];
  const color: ColorName = disabled ? "text-muted" : iconColor[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityLabel={text}
      disabled={inactive}
      onPress={onPress}
      // M buttons are 44 px tall but get a 48 px hit area.
      hitSlop={size === "M" ? 2 : undefined}
      className={size === "L" ? "w-full" : align === "center" ? "self-center" : "self-start"}
    >
      {({ pressed }) => (
        <View
          className={`flex-row items-center justify-center gap-8 rounded-md border-1.5 px-16 ${
            size === "L" ? "h-button-l" : "h-button-m"
          } ${boxClass} ${pressed && variant === "primary" && !inactive ? "bg-primary-hover" : ""} ${
            pressed && variant !== "primary" && !inactive ? "opacity-80" : ""
          }`}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors[color]} />
          ) : icon ? (
            <Icon name={icon} color={color} />
          ) : null}
          <Text variant="body" weight="600" tone={tone}>
            {text}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
