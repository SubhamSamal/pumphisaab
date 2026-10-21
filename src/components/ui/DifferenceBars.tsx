import { Pressable, View } from "react-native";
import { toDecimal } from "@/lib/decimal";
import { Text } from "./Text";

export type DifferenceBarTone = "loss" | "excess" | "matched" | "muted" | "empty";
export type DifferenceBar = {
  key: string;
  /** Litres (or ₹), as text; null = no bar (nothing to show that day). */
  value: string | null;
  tone: DifferenceBarTone;
  /** Read aloud and used for taps: "Thu 01 Oct: Short −26.58 L". */
  label: string;
};

const fill: Record<DifferenceBarTone, string> = {
  loss: "bg-danger",
  excess: "bg-warning",
  matched: "bg-success",
  muted: "bg-border-strong",
  empty: "bg-transparent",
};

const HALF = 64; // px above and below the zero line
const SCALE_W = 56; // the scale labels on the left ("−169 L")

/**
 * A row of daily Difference bars around a zero line (sign rule: short below in red, excess above in
 * amber, within limit green, not submitted grey). Tap a bar to pick that day. Heights are only a
 * picture: the numbers themselves are shown elsewhere, never read off the bars.
 */
export function DifferenceBars({
  bars,
  selectedKey,
  onSelect,
  startLabel,
  endLabel,
  topLabel,
  bottomLabel,
}: {
  bars: DifferenceBar[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  /** Under the first and last bar: "22 Sep", "21 Oct". */
  startLabel?: string;
  endLabel?: string;
  /** The scale: "+12 L" at the top, "−27 L" at the bottom. */
  topLabel?: string;
  bottomLabel?: string;
}) {
  const max = bars.reduce((m, b) => (b.value === null ? m : toDecimal(b.value).abs().greaterThan(m) ? toDecimal(b.value).abs() : m), toDecimal("0"));
  const height = (v: string) => {
    if (max.isZero()) return 2;
    const px = toDecimal(v).abs().dividedBy(max).times(HALF).toNumber();
    return Math.max(2, Math.round(px));
  };

  return (
    <View className="gap-4">
      <View className="flex-row gap-4">
        <View className="justify-between" style={{ width: SCALE_W, height: HALF * 2 }}>
          <Text variant="label" weight="400" tone="faint">
            {topLabel ?? ""}
          </Text>
          <Text variant="label" weight="400" tone="faint">
            {bottomLabel ?? ""}
          </Text>
        </View>
        <View className="min-w-0 flex-1 flex-row" style={{ height: HALF * 2 }}>
          {/* The zero line. */}
          <View className="absolute left-0 right-0 bg-border-strong" style={{ top: HALF, height: 1 }} />
          {bars.map((b) => {
            const selected = b.key === selectedKey;
            const up = b.value !== null && !toDecimal(b.value).isNegative();
            const h = b.value === null ? 0 : height(b.value);
            return (
              <Pressable
                key={b.key}
                onPress={onSelect && b.value !== null ? () => onSelect(b.key) : undefined}
                disabled={!onSelect || b.value === null}
                accessibilityRole="button"
                accessibilityLabel={b.label}
                accessibilityState={{ selected }}
                className={`flex-1 items-center rounded-sm ${selected ? "bg-primary-subtle" : ""}`}
                style={{ height: HALF * 2 }}
              >
                <View
                  className={`absolute rounded-sm ${fill[b.tone]}`}
                  style={{ width: "60%", height: h, ...(up ? { bottom: HALF } : { top: HALF + 1 }) }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      {startLabel || endLabel ? (
        <View className="flex-row justify-between" style={{ paddingLeft: SCALE_W + 4 }}>
          <Text variant="label" weight="400" tone="faint">
            {startLabel ?? ""}
          </Text>
          <Text variant="label" weight="400" tone="faint">
            {endLabel ?? ""}
          </Text>
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-12">
        {(
          [
            ["loss", "Short"],
            ["excess", "Excess"],
            ["matched", "Within limit"],
            ["muted", "Not submitted"],
          ] as const
        ).map(([tone, word]) => (
          <View key={tone} className="flex-row items-center gap-4">
            <View className={`rounded-sm ${fill[tone]}`} style={{ width: 10, height: 10 }} />
            <Text variant="label" weight="400" tone="secondary">
              {word}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
