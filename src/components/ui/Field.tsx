import { useState, type ReactNode } from "react";
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { text as textTokens, fontFamilyForWeight } from "@/theme/theme";
import { Icon } from "./Icon";
import { AutoTag } from "./Tag";
import { Text } from "./Text";

/** Label above a field: 14 px medium, secondary. */
export function FieldLabel({ children, extra }: { children: string; extra?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-4">
      <Text variant="label" tone="secondary">
        {children}
      </Text>
      {extra}
    </View>
  );
}

/** Red message under a field. Says what to fix. Never a toast. */
export function FieldError({ message }: { message: string }) {
  return (
    <View className="flex-row items-start gap-4" accessibilityLiveRegion="polite">
      <View className="mt-[2px]">
        <Icon name="error" color="danger" />
      </View>
      <Text variant="body" tone="danger" className="flex-1">
        {message}
      </Text>
    </View>
  );
}

/** Grey hint under a field ("Last night's closing dip: 128.5 cm"). */
export function FieldHint({ children }: { children: string }) {
  return (
    <Text variant="label" tone="muted">
      {children}
    </Text>
  );
}

export type FieldState = "default" | "error" | "warning";

type BoxProps = {
  focused: boolean;
  state: FieldState;
  disabled?: boolean;
  height?: "input" | "row";
  children: ReactNode;
};

/** The white typing box: 1.5 px strong border; focus = primary border + 3 px halo. */
export function FieldBox({ focused, state, disabled, height = "input", children }: BoxProps) {
  const { colors } = useTheme();
  const border =
    state === "error" ? "border-danger" : state === "warning" ? "border-warning" : focused ? "border-primary" : "border-border-strong";
  return (
    <View
      className={`flex-row items-center gap-8 rounded-sm border-1.5 bg-bg ${height === "input" ? "h-input-h px-12" : "h-tap px-[10px]"} ${border} ${
        disabled ? "opacity-[0.55]" : ""
      }`}
      style={focused && state === "default" ? { boxShadow: `0 0 0 3px ${colors["primary-subtle"]}` } : undefined}
    >
      {children}
    </View>
  );
}

export type NumericInputProps = {
  label?: string;
  value: string;
  onChangeText?: (v: string) => void;
  onBlur?: () => void;
  /** Trails the number: "₹", "L", "cm". */
  unit?: string;
  placeholder?: string;
  helper?: string;
  error?: string;
  warning?: boolean;
  disabled?: boolean;
  /** Calculated and read-only: grey box, lock and "auto" tag. Never editable. */
  auto?: boolean;
  /** Shown instead of the raw value when not focused (e.g. Indian grouping). */
  formatted?: string;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  inputRef?: React.Ref<TextInput>;
};

const numberStyle = {
  fontFamily: fontFamilyForWeight["600"],
  fontSize: textTokens["number-input"].fontSize,
  lineHeight: textTokens["number-input"].lineHeight,
  fontVariant: ["tabular-nums" as const],
};

/** Placeholder ("After the shift ends") is 16 px regular, not the 24 px number style. */
const placeholderStyle = {
  fontFamily: fontFamilyForWeight["400"],
  fontSize: textTokens.body.fontSize,
  lineHeight: textTokens.body.lineHeight,
};

/**
 * Every rupee, litre, cm and meter value. Opens the number pad, keeps typed text as a string
 * (no floating point), unit inside the box.
 */
export function NumericInput({
  label,
  value,
  onChangeText,
  onBlur,
  unit,
  placeholder,
  helper,
  error,
  warning,
  disabled,
  auto,
  formatted,
  keyboardType = "decimal-pad",
  returnKeyType = "next",
  onSubmitEditing,
  inputRef,
}: NumericInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  if (auto) {
    return (
      <View className="gap-4">
        {label ? <FieldLabel extra={<AutoTag />}>{label}</FieldLabel> : null}
        <View className="h-input-h flex-row items-center gap-8 rounded-sm border-1.5 border-border bg-auto-field-bg px-12">
          <Text variant="number-input" className="flex-1" numberOfLines={1}>
            {formatted ?? value}
          </Text>
          {unit ? (
            <Text variant="body" weight="500" tone="secondary">
              {unit}
            </Text>
          ) : null}
          <Icon name="lock" color="text-secondary" />
        </View>
      </View>
    );
  }

  const state: FieldState = error ? "error" : warning ? "warning" : "default";
  return (
    <View className="gap-4">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <FieldBox focused={focused} state={state} disabled={disabled}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          value={focused || formatted === undefined ? value : formatted}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          editable={!disabled}
          keyboardType={keyboardType}
          inputMode="decimal"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors["text-muted"]}
          selectionColor={colors.primary}
          style={[
            value === "" ? placeholderStyle : numberStyle,
            { flex: 1, minWidth: 0, color: colors["text-primary"], padding: 0 },
          ]}
        />
        {unit ? (
          <Text variant="body" weight="500" tone="secondary">
            {unit}
          </Text>
        ) : null}
      </FieldBox>
      {error ? <FieldError message={error} /> : helper ? <FieldHint>{helper}</FieldHint> : null}
    </View>
  );
}

export type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText?: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  /** Vehicle numbers: forced uppercase, no spaces, slashed zero. */
  vehicle?: boolean;
  secure?: boolean;
  disabled?: boolean;
  autoComplete?: TextInputProps["autoComplete"];
  /** Something inside the box on the right, e.g. a "Show" button for passwords. */
  right?: ReactNode;
  /** "words" for names; usernames and passwords stay as typed. */
  capitalize?: "none" | "words";
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  inputRef?: React.Ref<TextInput>;
};

/** Non-numeric field, 16 px medium text. */
export function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  helper,
  vehicle,
  secure,
  disabled,
  autoComplete,
  right,
  capitalize = "none",
  returnKeyType,
  onSubmitEditing,
  inputRef,
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-4">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <FieldBox focused={focused} state={error ? "error" : "default"} disabled={disabled}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          value={value}
          onChangeText={(v) => onChangeText?.(vehicle ? v.toUpperCase().replace(/[\s-]/g, "") : v)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          editable={!disabled}
          autoCapitalize={vehicle ? "characters" : capitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCorrect={false}
          autoComplete={autoComplete}
          secureTextEntry={secure}
          placeholder={placeholder}
          placeholderTextColor={colors["text-muted"]}
          selectionColor={colors.primary}
          style={[
            {
              flex: 1,
              minWidth: 0,
              padding: 0,
              color: colors["text-primary"],
              fontFamily: fontFamilyForWeight["500"],
              fontSize: textTokens.body.fontSize,
              lineHeight: textTokens.body.lineHeight,
            },
            vehicle ? ({ fontFeatureSettings: "'zero'" } as object) : null,
          ]}
        />
        {right}
      </FieldBox>
      {error ? <FieldError message={error} /> : helper ? <FieldHint>{helper}</FieldHint> : null}
    </View>
  );
}

/** Calculated value on a grey strip: "Dip in litres [auto] 14,820 L". */
export function AutoValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-12 rounded-sm bg-auto-field-bg px-12 py-[10px]">
      <View className="flex-row items-center gap-4">
        <Text variant="body" tone="secondary">
          {label}
        </Text>
        <AutoTag />
      </View>
      <Text variant="number-input">{value}</Text>
    </View>
  );
}
