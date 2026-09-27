import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { fromShown, showTyped } from "@/lib/numberInput";
import { useTheme } from "@/theme/ThemeProvider";
import { fontFamilyForWeight, text as textTokens } from "@/theme/theme";
import { FieldError } from "./Field";
import { Icon } from "./Icon";
import type { Product } from "./Tag";
import { Text } from "./Text";

/** Product header above a group of rows: "HSD · ₹90.00/L". */
export function NozzleGroupHeader({ product, detail }: { product: Product; detail?: string }) {
  const hsd = product === "HSD";
  return (
    <View className={`h-32 flex-row items-center gap-8 rounded-sm px-[10px] ${hsd ? "bg-hsd-tint" : "bg-ms-tint"}`}>
      <Text variant="label" weight="600" tone={hsd ? "hsd" : "ms"}>
        {product}
      </Text>
      {detail ? (
        <Text variant="label" tone={hsd ? "hsd" : "ms"} className="flex-1">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Column labels over the two boxes, so it's clear which box is which. */
export function NozzleColumnHeader({ first = "Opening", middle = "Closing" }: { first?: string; middle?: string; last?: string }) {
  return (
    <View className="flex-row gap-8 px-[2px]">
      <Text variant="label" tone="secondary" className="flex-1">
        {first}
      </Text>
      <Text variant="label" tone="secondary" className="flex-1">
        {middle}
      </Text>
    </View>
  );
}

// Meter numbers are 18 px semibold (fits 1,26,942.71 in half a 390 px screen). No fixed line
// height: on iPhone it pushes typed text down (cut off at the bottom).
const meterStyle = { fontFamily: fontFamilyForWeight["600"], fontSize: textTokens.heading.fontSize, fontVariant: ["tabular-nums" as const] };
const placeholderStyle = { fontFamily: fontFamilyForWeight["400"], fontSize: textTokens.label.fontSize };

type BoxProps = {
  value: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  editable: boolean;
  placeholder?: string;
  error?: boolean;
  a11y: string;
  inputRef?: React.Ref<TextInput>;
  onSubmitEditing?: () => void;
};

/** A white typing box for a meter reading, with Indian commas as you type. */
function MeterInput({ value, onChange, onBlur, editable, placeholder, error, a11y, inputRef, onSubmitEditing }: BoxProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? "border-danger" : focused ? "border-primary" : "border-border-strong";
  return (
    <View
      className={`h-tap min-w-0 flex-1 flex-row items-center rounded-sm border-1.5 px-[10px] ${border} ${editable ? "bg-bg" : "bg-surface"}`}
      style={focused && !error ? { boxShadow: `0 0 0 3px ${colors["primary-subtle"]}` } : undefined}
    >
      <TextInput
        ref={inputRef}
        accessibilityLabel={a11y}
        value={showTyped(value)}
        onChangeText={onChange ? (t) => onChange(fromShown(t)) : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        editable={editable}
        keyboardType="decimal-pad"
        inputMode="decimal"
        returnKeyType="next"
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors["text-muted"]}
        selectionColor={colors.primary}
        style={[value === "" ? placeholderStyle : meterStyle, { flex: 1, minWidth: 0, padding: 0, color: colors["text-primary"] }]}
      />
    </View>
  );
}

/** A grey, locked box: the opening copied from the last shift. Tap it to report a meter change. */
function MeterLocked({ value, changed, onPress, a11y }: { value: string; changed?: boolean; onPress?: () => void; a11y: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={a11y}
      className={`h-tap min-w-0 flex-1 flex-row items-center gap-4 rounded-sm border-1.5 px-[10px] ${
        changed ? "border-warning bg-warning-subtle" : "border-border bg-auto-field-bg"
      }`}
    >
      <Text variant="heading" numberOfLines={1} className="min-w-0 flex-1" tone={changed ? "warning" : "secondary"}>
        {value}
      </Text>
      <Icon name={changed ? "edit" : "lock"} size="small" color={changed ? "warning" : "text-muted"} />
    </Pressable>
  );
}

export type NozzleRowProps = {
  /** "HSD-3" */
  label: string;
  /** Litres sold, formatted ("223.26"), or undefined to show "—" until both readings are valid. */
  sale?: string;

  /** The opening, already formatted ("1,26,942.71"), shown in a grey locked box. */
  opening?: string;
  /** Opening changed and waiting for / approved by the owner (H2): amber box. */
  openingChanged?: boolean;
  /** Tap the locked opening (meter change sheet). */
  onPressOpening?: () => void;
  /** When there's no earlier closing to copy (first reading ever), the opening is a white typing box instead. */
  openingInput?: { value: string; onChange: (v: string) => void; onBlur?: () => void; editable?: boolean };

  closing: string;
  onChangeClosing?: (v: string) => void;
  onBlur?: () => void;
  /** false on a locked day. */
  editable?: boolean;
  placeholder?: string;
  inputRef?: React.Ref<TextInput>;
  onSubmitEditing?: () => void;

  /** Red, short, under the boxes (H1, a wrong number). */
  error?: string;
  /** Amber line under the boxes (e.g. a meter change waiting for the owner). Never blocks typing. */
  note?: string;
};

/**
 * One nozzle in a shift (owner's redesign, 27 Sep): name and sale on top, then two boxes side by
 * side, Opening and Closing. A copied opening is a grey locked box; only Closing is typed.
 */
export function NozzleRow({
  label,
  sale,
  opening,
  openingChanged,
  onPressOpening,
  openingInput,
  closing,
  onChangeClosing,
  onBlur,
  editable = true,
  placeholder = "Closing",
  inputRef,
  onSubmitEditing,
  error,
  note,
}: NozzleRowProps) {
  return (
    <View className={`gap-8 border-b border-border px-[2px] py-12 ${error ? "bg-danger-subtle" : ""}`}>
      <View className="flex-row items-baseline justify-between gap-8">
        <Text variant="heading">{label}</Text>
        <Text variant="number-inline" tone={error ? "danger" : sale ? "primary" : "muted"}>
          {sale ? `${sale} L` : "— L"}
        </Text>
      </View>
      <View className="flex-row gap-8">
        {openingInput ? (
          <MeterInput
            value={openingInput.value}
            onChange={openingInput.onChange}
            onBlur={openingInput.onBlur}
            editable={openingInput.editable ?? true}
            placeholder="Opening"
            a11y={`${label} opening reading`}
          />
        ) : (
          <MeterLocked value={opening ?? "—"} changed={openingChanged} onPress={onPressOpening} a11y={`${label}, opening ${opening ?? "not known yet"}`} />
        )}
        <MeterInput
          value={closing}
          onChange={onChangeClosing}
          onBlur={onBlur}
          editable={editable}
          placeholder={placeholder}
          error={Boolean(error)}
          a11y={`${label} closing reading`}
          inputRef={inputRef}
          onSubmitEditing={onSubmitEditing}
        />
      </View>
      {error ? (
        <FieldError message={error} />
      ) : note ? (
        <View className="flex-row items-start gap-4">
          <View className="mt-[2px]">
            <Icon name="clock" size="small" color="warning" />
          </View>
          <Text variant="label" weight="400" tone="warning" className="flex-1">
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
