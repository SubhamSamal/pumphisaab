import { View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";

/**
 * Teal drop mark with the saffron detail. Saffron appears ONLY here, never in UI states.
 * Sizes follow the canvas: 56 px on sign-in, 48 px at the top of the web rail.
 */
export function LogoMark({ size = 56 }: { size?: 48 | 56 }) {
  const small = size === 48;
  return (
    <View
      className={`items-center justify-center bg-primary ${small ? "h-[48px] w-[48px] rounded-md" : "h-[56px] w-[56px] rounded-[14px]"}`}
      accessibilityRole="image"
      accessibilityLabel="PumpHisaab"
    >
      <View className="-mt-4">
        <Icon name="drop" size="large" color="on-primary" />
      </View>
      <View className={`absolute h-[3px] rounded-[2px] bg-saffron ${small ? "bottom-8 left-12 right-12" : "bottom-[9px] left-[14px] right-[14px]"}`} />
    </View>
  );
}

/** "PumpHisaab" wordmark (Hisaab in teal) with the tagline underneath. */
export function Wordmark({ tagline = true }: { tagline?: boolean }) {
  return (
    <View className="gap-4">
      <Text variant="display" style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.3 }}>
        Pump
        <Text variant="display" tone="accent" style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.3 }}>
          Hisaab
        </Text>
      </Text>
      {tagline ? (
        <Text variant="heading" weight="500" tone="secondary">
          Sara hisaab ek jagah
        </Text>
      ) : null}
    </View>
  );
}
