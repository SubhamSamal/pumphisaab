import { View } from "react-native";
import { MINUS, fmtDifference, type DifferenceTone } from "@/lib/format";
import type { DecimalInput } from "@/lib/decimal";
import type { ColorName } from "@/theme/theme";
import { Icon, type IconName } from "./Icon";
import { Text, type TextTone } from "./Text";

const spec: Record<DifferenceTone, { box: string; tone: TextTone; icon: IconName; color: ColorName }> = {
  loss: { box: "bg-danger-subtle border-danger", tone: "danger", icon: "warning", color: "danger" },
  excess: { box: "bg-warning-subtle border-warning", tone: "warning", icon: "warning", color: "warning" },
  matched: { box: "bg-success-subtle border-success", tone: "success", icon: "check", color: "success" },
};

export type DifferenceValueProps = {
  value: DecimalInput;
  unit: "rupees" | "litres";
  /** Litres only: Sold as per tank, to show the percentage. */
  percentOf?: DecimalInput;
  /** `pill` for headlines and cards, `inline` inside rows. */
  look?: "pill" | "inline";
  /** Hide the word ("Short"/"Excess") where space is tight, e.g. the dashboard's "−42 L". */
  hideWord?: boolean;
  /**
   * The calc engine decides tolerance, not this component. When the difference is inside the
   * owner's limit, pass true: it shows green "OK · 30 L" instead of Short/Excess.
   */
  withinLimit?: boolean;
};

/**
 * A Difference, following the sign rule: negative = loss (red, true minus, "Short"),
 * positive = excess (amber, "Excess"), zero = green "Matched". Always icon + word + colour.
 */
export function DifferenceValue({ value, unit, percentOf, look = "pill", hideWord, withinLimit }: DifferenceValueProps) {
  const d = fmtDifference(value, unit, percentOf);
  let tone = d.tone;
  let words: string;
  if (d.tone === "matched") {
    words = "Matched";
  } else if (withinLimit) {
    tone = "matched";
    words = `OK · ${d.text.replace(/^[+−]/, "").replace(MINUS, "")}`;
  } else {
    words = hideWord ? d.text : `${d.word} ${d.text}`;
  }
  const s = spec[tone];

  if (look === "inline") {
    return (
      <View className="flex-row items-center gap-4">
        <Icon name={s.icon} size="small" color={s.color} />
        <Text variant="number-inline" weight="600" tone={s.tone}>
          {words}
        </Text>
      </View>
    );
  }
  return (
    <View className={`h-32 flex-row items-center gap-4 self-start rounded-full border px-[10px] ${s.box}`}>
      <Icon name={s.icon} size="small" color={s.color} />
      <Text variant="body" weight="600" tone={s.tone}>
        {words}
      </Text>
    </View>
  );
}
