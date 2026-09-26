import { Pressable, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";

/** 48 px chip (attendants, expense types). Selected = tint + primary border + tick. */
export function Chip({ label, selected, onPress, small }: { label: string; selected?: boolean; onPress?: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      className={`flex-row items-center gap-8 rounded-sm border-1.5 ${small ? "h-40 px-12" : "h-tap px-16"} ${
        selected ? "border-primary bg-primary-subtle" : "border-border-strong bg-bg"
      }`}
    >
      {selected ? <Icon name="check" size="small" color="primary-hover" /> : null}
      <Text variant="body" weight={selected ? "600" : "500"} tone={selected ? "accentStrong" : "primary"}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Chips wrap onto new lines; never scroll sideways. */
export function ChipGroup({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-8">{children}</View>;
}

/** For 3 or fewer options instead of a dropdown. Selected segment has a tick, so it never relies on colour. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row gap-4 rounded-sm border-1.5 border-border-strong bg-bg p-4" accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            hitSlop={4}
            className={`h-40 flex-1 flex-row items-center justify-center gap-4 rounded-sm border-1.5 ${
              on ? "border-primary bg-primary-subtle" : "border-transparent"
            }`}
          >
            {on ? <Icon name="check" size="small" color="primary-hover" /> : null}
            <Text variant="body" weight={on ? "600" : "500"} tone={on ? "accentStrong" : "secondary"}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 52 × 32 switch. On = primary. */
export function Switch({ value }: { value: boolean }) {
  return value ? (
    <View className="h-32 w-[52px] justify-center rounded-full bg-primary p-[2px]">
      <View className="ml-[20px] h-[28px] w-[28px] rounded-full bg-on-primary" />
    </View>
  ) : (
    <View className="h-32 w-[52px] justify-center rounded-full border-1.5 border-border-strong bg-auto-field-bg">
      <View className="ml-[1px] h-[26px] w-[26px] rounded-full bg-border-strong" />
    </View>
  );
}

/** The whole row is the tap target (min 64 px), not just the switch. */
export function ToggleRow({ label, helper, value, onChange }: { label: string; helper?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      className="min-h-[64px] flex-row items-center gap-12"
    >
      <View className="min-w-0 flex-1">
        <Text variant="body" weight="500">
          {label}
        </Text>
        {helper ? (
          <Text variant="label" weight="400" tone="secondary">
            {helper}
          </Text>
        ) : null}
      </View>
      <Switch value={value} />
    </Pressable>
  );
}
