import { useState } from "react";
import { Pressable, View } from "react-native";
import { FieldBox, FieldError, FieldLabel } from "./Field";
import { Icon } from "./Icon";
import { BottomSheet } from "./Overlay";
import { Text } from "./Text";

export type SelectOption<T extends string> = { value: T; label: string; detail?: string };

/**
 * Pick ONE from a list (owner, 03 Oct: chips looked like "pick many"). Looks like a box with a ▾;
 * tapping it opens the list from the bottom, one tap picks and closes.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Tap to choose",
  title,
  disabled,
  error,
}: {
  label?: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  placeholder?: string;
  /** Heading of the list (defaults to the label). */
  title?: string;
  disabled?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  return (
    <View className="gap-4">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Pressable
        onPress={disabled ? undefined : () => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? title ?? "Choose"}: ${chosen?.label ?? "not chosen"}`}
      >
        <FieldBox focused={false} state={error ? "error" : "default"} disabled={disabled}>
          <Text variant="body" weight={chosen ? "500" : "400"} tone={chosen ? "primary" : "muted"} className="min-w-0 flex-1">
            {chosen?.label ?? placeholder}
          </Text>
          <Icon name="chevronDown" color="text-secondary" />
        </FieldBox>
      </Pressable>
      {error ? <FieldError message={error} /> : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text variant="heading">{title ?? label ?? "Choose one"}</Text>
        <View>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className="min-h-tap flex-row items-center gap-12 border-b border-border py-8 active:bg-surface"
              >
                <View className={`h-24 w-24 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-border-strong"}`}>
                  {selected ? <View className="h-12 w-12 rounded-full bg-primary" /> : null}
                </View>
                <View className="min-w-0 flex-1">
                  <Text variant="body" weight={selected ? "600" : "400"}>
                    {o.label}
                  </Text>
                  {o.detail ? (
                    <Text variant="label" weight="400" tone="secondary">
                      {o.detail}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

/**
 * Tick everyone that applies (owner, 03 Oct: "who worked" as a tick list). The tick shows at once;
 * `busy` greys the row while it saves, so a second tap can't send a second change.
 */
export function CheckRow({ label, checked, onPress, busy, disabled }: { label: string; checked: boolean; onPress?: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={disabled || busy ? undefined : onPress}
      disabled={disabled || busy || !onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, busy: Boolean(busy) }}
      className={`min-h-tap flex-row items-center gap-12 border-b border-border py-8 ${busy ? "opacity-[0.6]" : ""}`}
    >
      <View className={`h-24 w-24 items-center justify-center rounded-[6px] border-2 ${checked ? "border-primary bg-primary" : "border-border-strong bg-bg"}`}>
        {checked ? <Icon name="check" size="small" color="on-primary" /> : null}
      </View>
      <Text variant="body" weight={checked ? "600" : "400"} className="min-w-0 flex-1">
        {label}
      </Text>
    </Pressable>
  );
}
