import { Redirect, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { Card, DifferenceValue, EmptyState, ErrorState, ProductTag, ScreenBody, Skeleton, Text } from "@/components/ui";
import { useFuelTrend } from "@/features/dashboard/queries";
import { TREND_DAYS } from "@/features/dashboard/trend";
import { TrendDayRow } from "@/features/dashboard/TrendDayRow";
import { useSelectedDay } from "@/features/day/SelectedDay";
import { useMembership, useSession } from "@/features/session/SessionProvider";
import { ComingSoon } from "@/features/shell/ComingSoon";
import { MainHeader } from "@/features/shell/MainHeader";
import { track } from "@/lib/analytics";
import { fmtRupees } from "@/lib/format";

/**
 * Dashboard (owner only). Phase 5a: the fuel trend (D109, D113), to watch a daily short (the
 * petrol short of 1 Oct) day by day. Today's summary and the matched calendar come in Phase 6.
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

  useEffect(() => {
    track("fuel_trend_opened");
  }, []);

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
            {`Last ${TREND_DAYS} days: Sold as per meters minus Sold as per tank. Only submitted days count in the month total. Tap a day to open it.`}
          </Text>
        </View>

        {trend.isPending ? (
          <Skeleton height={320} />
        ) : trend.isError ? (
          <ErrorState title="Couldn't load the fuel trend" body="Check the internet and try again." onRetry={() => trend.refetch()} />
        ) : trend.data.rows.length === 0 ? (
          <EmptyState icon="dashboard" title="No days yet" body="Days show here once the managers start them." />
        ) : (
          <>
            {trend.data.month.length > 0 ? (
              <Card tone="summary">
                <Text variant="label" tone="secondary">
                  {`This month (${trend.data.monthLabel})`}
                </Text>
                {trend.data.month.map((t) => (
                  <View key={t.product} className="gap-4">
                    <View className="flex-row flex-wrap items-center gap-8">
                      <ProductTag product={t.product} />
                      <DifferenceValue value={t.difference} unit="litres" percentOf={t.soldAsPerTank} />
                    </View>
                    <Text variant="label" weight="400" tone="secondary">
                      {`About ${fmtRupees(t.rupees)} · ${t.days} ${t.days === 1 ? "day" : "days"} submitted`}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <View>
              {trend.data.rows.map((r) => (
                <TrendDayRow key={r.dayId} row={r} onPress={() => openDay(r.date)} />
              ))}
            </View>
          </>
        )}

        <ComingSoon icon="dashboard" line="Today's summary and the 30-day matched calendar arrive in Phase 6." />
      </ScreenBody>
    </>
  );
}
