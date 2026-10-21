import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  DifferenceBars,
  DifferenceValue,
  EmptyState,
  ErrorState,
  KeyValueRow,
  ScreenBody,
  SegmentedControl,
  Skeleton,
  Text,
  type DifferenceBar,
} from "@/components/ui";
import type { Product } from "@/calc";
import { NozzleChecks } from "@/features/dashboard/NozzleChecks";
import { useFuelTrend, useNozzleChecks } from "@/features/dashboard/queries";
import { TREND_DAYS, latestWithDifference, trendBars, type TrendBar } from "@/features/dashboard/trend";
import { TrendDayRow } from "@/features/dashboard/TrendDayRow";
import { useSelectedDay } from "@/features/day/SelectedDay";
import { useMembership, useSession } from "@/features/session/SessionProvider";
import { ComingSoon } from "@/features/shell/ComingSoon";
import { MainHeader } from "@/features/shell/MainHeader";
import { track } from "@/lib/analytics";
import { toDecimal } from "@/lib/decimal";
import { fmtDate, fmtDifference, fmtLitres, fmtRupees } from "@/lib/format";

const FUELS = [
  { value: "HSD", label: "Diesel" },
  { value: "MS", label: "Petrol" },
] as const satisfies readonly { value: Product; label: string }[];

/**
 * Dashboard (owner only). Phase 5a: the fuel trend (D109, D113) as a picture first: one bar per
 * day for the last 30 days, then the day tapped, then (folded) every day's numbers (owner, 21 Oct).
 * Today's summary and the matched calendar come in Phase 6.
 */
export default function DashboardScreen() {
  const { role } = useSession();
  if (role !== "owner") return <Redirect href="/" />;
  return <OwnerDashboard />;
}

function OwnerDashboard() {
  const me = useMembership();
  const router = useRouter();
  const { today, serverKnown, setDate } = useSelectedDay();
  const trend = useFuelTrend(me.pump.id, serverKnown ? today : undefined);
  const checks = useNozzleChecks(me.pump.id, serverKnown ? today : undefined);
  const [fuel, setFuel] = useState<Product>("HSD");
  const [picked, setPicked] = useState<string | null>(null);
  const [showDays, setShowDays] = useState(false);

  useEffect(() => {
    track("fuel_trend_opened");
  }, []);

  const bars = useMemo(() => (trend.data ? trendBars(trend.data, fuel, today) : []), [trend.data, fuel, today]);
  const selectedDate = picked && bars.some((b) => b.date === picked && b.tone !== "empty") ? picked : latestWithDifference(bars);
  const selected = bars.find((b) => b.date === selectedDate) ?? null;
  const month = trend.data?.month.find((m) => m.product === fuel);

  const openDay = (date: string) => {
    setDate(date);
    router.push({ pathname: "/day/review", params: { date } });
  };

  return (
    <>
      <MainHeader title="Dashboard" />
      <ScreenBody>
        <View className="gap-4">
          <Text variant="heading">Fuel trend</Text>
          <Text variant="body" tone="secondary">
            {`Each bar is one day of the last ${TREND_DAYS}: Sold as per meters minus Sold as per tank. Tap a bar to see that day.`}
          </Text>
        </View>

        <SegmentedControl options={FUELS} value={fuel} onChange={setFuel} />

        {trend.isPending ? (
          <Skeleton height={320} />
        ) : trend.isError ? (
          <ErrorState title="Couldn't load the fuel trend" body="Check the internet and try again." onRetry={() => trend.refetch()} />
        ) : trend.data.rows.length === 0 ? (
          <EmptyState icon="dashboard" title="No days yet" body="Days show here once the managers start them." />
        ) : (
          <>
            <Card tone="summary">
              <Text variant="label" tone="secondary">
                {`This month (${trend.data.monthLabel})`}
              </Text>
              {month ? (
                <>
                  <DifferenceValue value={month.difference} unit="litres" percentOf={month.soldAsPerTank} />
                  <Text variant="label" weight="400" tone="secondary">
                    {`About ${fmtRupees(month.rupees)} · ${month.days} ${month.days === 1 ? "day" : "days"} submitted`}
                  </Text>
                </>
              ) : (
                <Text variant="body" tone="secondary">
                  No submitted day this month yet.
                </Text>
              )}
            </Card>

            <DifferenceBars
              bars={bars.map(toBar)}
              selectedKey={selectedDate}
              onSelect={setPicked}
              startLabel={fmtDate(bars[0].date, "short")}
              endLabel="Today"
              {...scaleLabels(bars)}
            />

            {selected ? <DayDetail bar={selected} onOpen={() => openDay(selected.date)} /> : null}

            <View>
              <Button
                label={showDays ? "Hide the list of days" : `Show all days as a list (${trend.data.rows.length})`}
                size="M"
                variant="ghost"
                icon={showDays ? "chevronUp" : "chevronDown"}
                onPress={() => setShowDays((v) => !v)}
              />
              {showDays ? trend.data.rows.map((r) => <TrendDayRow key={r.dayId} row={r} onPress={() => openDay(r.date)} />) : null}
            </View>
          </>
        )}

        {checks.data && checks.data.length > 0 ? <NozzleChecks groups={checks.data} /> : null}

        <ComingSoon icon="dashboard" line="Today's summary and the 30-day matched calendar arrive in Phase 6." />
      </ScreenBody>
    </>
  );
}

function toBar(b: TrendBar): DifferenceBar {
  const label = fmtDate(b.date, "short");
  if (b.tone === "empty" || !b.cell || b.cell.difference === null) return { key: b.date, value: null, tone: "empty", label: `${label}: no Difference yet` };
  const d = fmtDifference(b.cell.difference, "litres");
  return {
    key: b.date,
    value: b.cell.difference,
    tone: b.tone === "notSubmitted" ? "muted" : b.tone,
    label: `${label}: ${d.tone === "matched" ? d.text : `${d.word} ${d.text}`}${b.submitted ? "" : ", not submitted"}`,
  };
}

/** "+12 L" / "−27 L": the biggest excess and short in the window (the chart's scale). */
function scaleLabels(bars: TrendBar[]): { topLabel?: string; bottomLabel?: string } {
  let max = toDecimal("0");
  for (const b of bars) if (b.cell?.difference) max = toDecimal(b.cell.difference).abs().greaterThan(max) ? toDecimal(b.cell.difference).abs() : max;
  if (max.isZero()) return {};
  const whole = max.toDecimalPlaces(0, 0); // round up so the label covers the tallest bar
  return { topLabel: `+${whole.toFixed(0)} L`, bottomLabel: `−${whole.toFixed(0)} L` };
}

/** The day tapped: tank, meters, Difference and about ₹, with a way into its Review. */
function DayDetail({ bar, onOpen }: { bar: TrendBar; onOpen: () => void }) {
  const c = bar.cell;
  return (
    <Card>
      <View className="flex-row flex-wrap items-center gap-8">
        <Text variant="body" weight="600">
          {fmtDate(bar.date, "weekday")}
        </Text>
        {!bar.submitted ? (
          <Text variant="label" weight="400" tone="muted">
            not submitted
          </Text>
        ) : null}
      </View>
      {c && c.difference !== null && c.soldAsPerTank !== null ? (
        <>
          <KeyValueRow label="Sold as per tank" value={fmtLitres(c.soldAsPerTank)} />
          <KeyValueRow label="Sold as per meters" value={fmtLitres(c.soldAsPerMeters)} />
          <DifferenceValue value={c.difference} unit="litres" percentOf={c.soldAsPerTank} withinLimit={c.withinLimit === true} />
          {c.rupees ? (
            <Text variant="label" weight="400" tone="secondary">
              {`About ${fmtRupees(c.rupees)} at that day's price`}
            </Text>
          ) : null}
        </>
      ) : null}
      <Button label="Open this day's Review" size="M" variant="secondary" onPress={onOpen} />
    </Card>
  );
}
