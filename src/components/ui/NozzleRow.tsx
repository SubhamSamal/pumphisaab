import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fontFamilyForWeight, text as textTokens } from "@/theme/theme";
import { FieldError } from "./Field";
import { Icon } from "./Icon";
import type { Product } from "./Tag";
import { Text } from "./Text";

// Canvas grid: 92 px | flexible | 80 px, 8 px gaps. 8 nozzles + 2 group headers fit a 390 px screen.
const ID_W = "w-[92px]";
const SALE_W = "w-[80px]";

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

/** Column labels, so it's clear which box to type in. */
export function NozzleColumnHeader({ first = "Opening", middle = "Closing reading", last = "Sale" }) {
  return (
    <View className="flex-row gap-8 px-[2px]">
      <Text variant="label" tone="secondary" className={ID_W}>
        {first}
      </Text>
      <Text variant="label" tone="secondary" className="flex-1">
        {middle}
      </Text>
      <Text variant="label" tone="secondary" className={`${SALE_W} text-right`}>
        {last}
      </Text>
    </View>
  );
}

export type NozzleRowProps = {
  /** "HSD-A" */
  label: string;
  /** Opening meter, already formatted ("48,210.00"). Locked; tap to request a meter change. */
  opening: string;
  closing: string;
  onChangeClosing?: (v: string) => void;
  onBlur?: () => void;
  /** Litres sold, formatted, or undefined to show "—" until closing is valid. */
  sale?: string;
  error?: string;
  /** Opening changed and waiting for the owner (H2). */
  openingChanged?: boolean;
  onPressOpening?: () => void;
  inputRef?: React.Ref<TextInput>;
  onSubmitEditing?: () => void;
};

/** The key entry row: one per nozzle, 64 px. Only Closing is typed. */
export function NozzleRow({
  label,
  opening,
  closing,
  onChangeClosing,
  onBlur,
  sale,
  error,
  openingChanged,
  onPressOpening,
  inputRef,
  onSubmitEditing,
}: NozzleRowProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? "border-danger" : focused ? "border-primary" : "border-border-strong";

  return (
    <View>
      <View className={`h-nozzle-row flex-row items-center gap-8 border-b border-border px-[2px] ${error ? "bg-danger-subtle" : ""}`}>
        <Pressable
          className={ID_W}
          onPress={onPressOpening}
          disabled={!onPressOpening}
          accessibilityRole={onPressOpening ? "button" : undefined}
          accessibilityLabel={`${label}, opening ${opening}`}
        >
          <Text variant="body" weight="600">
            {label}
          </Text>
          <View className="flex-row items-center gap-[2px]">
            <Icon name={openingChanged ? "edit" : "lock"} size="small" color={openingChanged ? "warning" : "text-muted"} />
            <Text variant="caption" tone={openingChanged ? "warning" : "muted"}>
              {opening}
            </Text>
          </View>
        </Pressable>
        <View
          className={`h-tap flex-1 flex-row items-center rounded-sm border-1.5 bg-bg px-[10px] ${border}`}
          style={focused && !error ? { boxShadow: `0 0 0 3px ${colors["primary-subtle"]}` } : undefined}
        >
          <TextInput
            ref={inputRef}
            accessibilityLabel={`${label} closing reading`}
            value={closing}
            onChangeText={onChangeClosing}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            keyboardType="decimal-pad"
            inputMode="decimal"
            returnKeyType="next"
            onSubmitEditing={onSubmitEditing}
            placeholder="Type here"
            placeholderTextColor={colors["text-muted"]}
            selectionColor={colors.primary}
            style={{
              flex: 1,
              minWidth: 0,
              padding: 0,
              color: colors["text-primary"],
              // Placeholder is 16 px regular; typed readings are 22 px semibold.
              fontFamily: fontFamilyForWeight[closing === "" ? "400" : "600"],
              fontSize: closing === "" ? textTokens.body.fontSize : textTokens.title.fontSize,
              // No fixed line height: on iPhone it pushes typed text down (cut off at the bottom).
              fontVariant: ["tabular-nums"],
            }}
          />
        </View>
        <View className={`${SALE_W} items-end`}>
          <Text variant="heading" tone={error ? "danger" : "primary"}>
            {sale ?? "—"}
          </Text>
          <Text variant="caption" tone="muted">
            L
          </Text>
        </View>
      </View>
      {error ? (
        <View className="pt-4">
          <FieldError message={error} />
        </View>
      ) : null}
    </View>
  );
}
