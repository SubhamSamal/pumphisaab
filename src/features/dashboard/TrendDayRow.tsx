import { Pressable, View } from "react-native";
import { DifferenceValue, Icon, ProductTag, Text } from "@/components/ui";
import { fmtDate, fmtRupees } from "@/lib/format";
import type { TrendRow } from "./trend";

export /** One business day: each fuel's Difference (L, %) and about ₹; "not submitted" until it is. */
function TrendDayRow({ row, onPress }: { row: TrendRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-12 border-b border-border py-[10px]">
      <View className="min-w-0 flex-1 gap-4">
        <View className="flex-row flex-wrap items-center gap-8">
          <Text variant="body" weight="600">
            {fmtDate(row.date, "weekday")}
          </Text>
          {!row.submitted ? (
            <Text variant="label" weight="400" tone="muted">
              not submitted
            </Text>
          ) : null}
        </View>
        {row.cells.map((c) => (
          <View key={c.product} className="flex-row flex-wrap items-center gap-8">
            <ProductTag product={c.product} />
            {c.difference === null || c.soldAsPerTank === null ? (
              <Text variant="label" weight="400" tone="muted">
                Dips not in yet
              </Text>
            ) : (
              <>
                <DifferenceValue value={c.difference} unit="litres" percentOf={c.soldAsPerTank} look="inline" withinLimit={c.withinLimit === true} />
                {c.rupees && !c.withinLimit ? (
                  <Text variant="label" weight="400" tone="secondary">
                    {`about ${fmtRupees(c.rupees)}`}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        ))}
      </View>
      <Icon name="chevronRight" color="text-muted" />
    </Pressable>
  );
}
