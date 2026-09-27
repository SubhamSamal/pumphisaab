import { useState } from "react";
import { TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { fontFamilyForWeight, text as textTokens } from "@/theme/theme";
import { typingText } from "./Field";
import { Text } from "./Text";

export type NoteCountRowProps = {
  /** "₹500" */
  note: string;
  /** How many notes, as typed (whole numbers only). */
  count: string;
  onChangeCount?: (v: string) => void;
  onBlur?: () => void;
  /** note × count, already formatted ("₹5,000"). */
  amount: string;
  editable?: boolean;
};

// No fixed line height on the typing box (iPhone cuts typed text off at the bottom).
const countStyle = { fontFamily: fontFamilyForWeight["600"], fontSize: textTokens.heading.fontSize, fontVariant: ["tabular-nums" as const] };

/** One line of the cash note count (PRD F6, D20): "₹500 × [ 150 ] = ₹75,000". Blank counts as 0. */
export function NoteCountRow({ note, count, onChangeCount, onBlur, amount, editable = true }: NoteCountRowProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View className="min-h-[56px] flex-row items-center gap-8 border-b border-border py-4">
      <Text variant="heading" className="w-[64px]">
        {note}
      </Text>
      <Text variant="body" tone="secondary">
        ×
      </Text>
      <View
        className={`h-tap w-[96px] flex-row items-center rounded-sm border-1.5 px-[10px] ${focused ? "border-primary" : "border-border-strong"} ${
          editable ? "bg-bg" : "bg-surface"
        }`}
        style={focused ? { boxShadow: `0 0 0 3px ${colors["primary-subtle"]}` } : undefined}
      >
        <TextInput
          accessibilityLabel={`${note} notes`}
          value={count}
          onChangeText={onChangeCount ? (t) => onChangeCount(t.replace(/[^0-9]/g, "")) : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          editable={editable}
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="next"
          placeholder="0"
          placeholderTextColor={colors["text-muted"]}
          selectionColor={colors.primary}
          style={[countStyle, typingText, { color: colors["text-primary"] }]}
        />
      </View>
      <Text variant="number-inline" tone={amount === "₹0" ? "muted" : "primary"} className="flex-1 text-right">
        {amount}
      </Text>
    </View>
  );
}
