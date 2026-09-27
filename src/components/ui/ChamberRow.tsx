import { useState } from "react";
import { TextInput, View } from "react-native";
import { fromShown, showTyped } from "@/lib/numberInput";
import { useTheme } from "@/theme/ThemeProvider";
import { fontFamilyForWeight, text as textTokens } from "@/theme/theme";
import { FieldError } from "./Field";
import { Text } from "./Text";

// Chamber boxes are narrow: 16 px numbers; no fixed line height and no Android font padding
// (both cut typed numbers off).
const numStyle = { fontFamily: fontFamilyForWeight["600"], fontSize: textTokens.body.fontSize, fontVariant: ["tabular-nums" as const] };
const placeholderStyle = { fontFamily: fontFamilyForWeight["400"], fontSize: textTokens.label.fontSize };

function SmallNumber({ value, onChange, placeholder, a11y, editable }: { value: string; onChange?: (v: string) => void; placeholder: string; a11y: string; editable: boolean }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View
      className={`h-tap min-w-0 flex-1 flex-row items-center rounded-sm border-1.5 px-8 ${focused ? "border-primary" : "border-border-strong"} ${editable ? "bg-bg" : "bg-surface"}`}
    >
      <TextInput
        accessibilityLabel={a11y}
        value={showTyped(value)}
        onChangeText={onChange ? (t) => onChange(fromShown(t)) : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType="decimal-pad"
        inputMode="decimal"
        returnKeyType="next"
        placeholder={placeholder}
        placeholderTextColor={colors["text-muted"]}
        selectionColor={colors.primary}
        style={[
          value === "" ? placeholderStyle : numStyle,
          { includeFontPadding: false, textAlignVertical: "center" },
          { flex: 1, minWidth: 0, padding: 0, color: colors["text-primary"] },
        ]}
      />
    </View>
  );
}

/** Column labels over the chamber rows. */
export function ChamberHeader() {
  return (
    <View className="flex-row items-center gap-8">
      <Text variant="caption" tone="secondary" className="w-[20px]">
        #
      </Text>
      <Text variant="caption" tone="secondary" className="flex-1">
        Litres
      </Text>
      <Text variant="caption" tone="secondary" className="flex-1">
        Dip before
      </Text>
      <Text variant="caption" tone="secondary" className="flex-1">
        Dip after
      </Text>
    </View>
  );
}

export type ChamberRowProps = {
  no: number;
  litres: string;
  onChangeLitres?: (v: string) => void;
  dipBefore: string;
  onChangeBefore?: (v: string) => void;
  dipAfter: string;
  onChangeDip?: (v: string) => void;
  /** "3,999.99 L", or undefined until both dips are known. */
  rise?: string;
  /** "short 14.46 L" / "over 2 L"; amber when it's a flag. */
  short?: string;
  shortWarn?: boolean;
  error?: string;
  editable?: boolean;
};

/**
 * One tanker chamber (owner, 27 Sep: chamber-wise dips are mandatory): the chamber's litres from
 * the challan, our tank's dip just before and just after it is emptied (its own "before", since
 * fuel can be sold between chambers), then one line: how much the tank went up and the short.
 */
export function ChamberRow({ no, litres, onChangeLitres, dipBefore, onChangeBefore, dipAfter, onChangeDip, rise, short, shortWarn, error, editable = true }: ChamberRowProps) {
  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-8">
        <Text variant="body" weight="600" className="w-[20px]">
          {no}
        </Text>
        <SmallNumber value={litres} onChange={onChangeLitres} placeholder="Litres" a11y={`Chamber ${no} litres`} editable={editable} />
        <SmallNumber value={dipBefore} onChange={onChangeBefore} placeholder="cm" a11y={`Dip before chamber ${no}`} editable={editable} />
        <SmallNumber value={dipAfter} onChange={onChangeDip} placeholder="cm" a11y={`Dip after chamber ${no}`} editable={editable} />
      </View>
      {rise || error ? (
        <View className="flex-row items-center justify-end gap-8 pl-[28px]">
          {rise ? (
            <Text variant="caption" tone="secondary">
              {`Tank went up ${rise}`}
            </Text>
          ) : null}
          {short ? (
            <Text variant="caption" weight="600" tone={shortWarn ? "warning" : "secondary"}>
              {short}
            </Text>
          ) : null}
        </View>
      ) : null}
      {error ? <FieldError message={error} /> : null}
    </View>
  );
}
