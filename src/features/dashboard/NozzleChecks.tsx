import { View } from "react-native";
import { ProductTag, Text } from "@/components/ui";
import { toDecimal } from "@/lib/decimal";
import { fmtDate, fmtDifference, fmtLitres } from "@/lib/format";
import type { NozzleCheckGroup, NozzleCheckRow } from "./trend";

/**
 * Each nozzle's recent 5 L measure checks (D110), newest first, with who was on it (D115).
 * A nozzle that gives MORE than its meter (the pump loses) is red; LESS (customers lose) is amber;
 * within the limit is green.
 */
export function NozzleChecks({ groups }: { groups: NozzleCheckGroup[] }) {
  return (
    <View className="gap-12">
      <View className="gap-4">
        <Text variant="heading">Nozzle checks (5 L measure)</Text>
        <Text variant="label" weight="400" tone="secondary">
          What the measure got against what the meter showed, last 30 days.
        </Text>
      </View>
      {groups.map((g) => (
        <View key={g.nozzleId} className="gap-4 border-b border-border pb-8">
          <View className="flex-row flex-wrap items-center gap-8">
            <ProductTag product={g.product} />
            <Text variant="body" weight="600">
              {g.label}
            </Text>
            <Text variant="label" weight="400" tone={g.flaggedCount ? "danger" : "success"}>
              {g.flaggedCount ? `${g.flaggedCount} beyond the limit` : "all within the limit"}
            </Text>
          </View>
          {g.checks.map((c) => (
            <CheckLine key={`${c.date}-${c.shift}-${c.measuredLitres}-${c.meterLitres}`} c={c} />
          ))}
        </View>
      ))}
    </View>
  );
}

function CheckLine({ c }: { c: NozzleCheckRow }) {
  const error = toDecimal(c.error);
  const text = error.isZero() ? "same as the meter" : `${fmtDifference(c.error, "litres").text} (${toDecimal(c.errorPercent).toFixed(2)}%)`;
  const tone = !c.flagged ? "success" : error.isPositive() ? "danger" : "warning";
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-8">
      <Text variant="label" weight="400" tone="secondary" className="min-w-0 flex-1">
        {`${fmtDate(c.date, "short")} · Shift ${c.shift}${c.who ? ` · ${c.who}` : ""} · ${fmtLitres(c.measuredLitres)} for ${fmtLitres(c.meterLitres)}`}
      </Text>
      <Text variant="label" weight="600" tone={tone}>
        {c.flagged
          ? `${fmtLitres(error.abs())} ${error.isPositive() ? "more" : "less"} (${toDecimal(c.errorPercent).abs().toFixed(2)}%)`
          : `OK · ${text}`}
      </Text>
    </View>
  );
}
