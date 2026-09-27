import { useRouter } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Button,
  ErrorState,
  ListItem,
  ScreenBody,
  Skeleton,
  StatusPill,
  StickyActionBar,
  Text,
} from "@/components/ui";
import { evaluate, tankerInputs } from "@/features/day/model";
import { useDay, useDaySetup, useRecentTankers, useTankers, type Receipt } from "@/features/day/queries";
import { useSelectedDay } from "@/features/day/SelectedDay";
import { useMembership } from "@/features/session/SessionProvider";
import { MainHeader } from "@/features/shell/MainHeader";
import { Decimal } from "@/lib/decimal";
import { fmtDate, fmtLitres } from "@/lib/format";

/** "HSD 13,972 L · MS 3,980 L": litres received (ordered − short, exact decimals). */
const receivedLine = (r: Receipt) => r.lines.map((l) => `${l.product} ${fmtLitres(new Decimal(l.orderedLitres).minus(l.shortLitres))}`).join(" · ");

/** Tanker tab (canvas F4): today's tankers, earlier tankers, Add tanker. No tanker added = none came (owner, 27 Sep). */
export default function TankerScreen() {
  const me = useMembership();
  const router = useRouter();
  const { date, serverKnown, isToday } = useSelectedDay();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, serverKnown ? date : undefined);
  const tankers = useTankers(day.data?.id);
  const recent = useRecentTankers(me.pump.id);

  const failed = setup.error ?? day.error ?? tankers.error ?? recent.error;
  const loading = setup.isPending || day.isPending || tankers.isPending || recent.isPending;
  const locked = Boolean(day.data?.isLocked);
  const list = tankers.data ?? [];
  const flagsFor = (r: Receipt) =>
    setup.data && day.data ? evaluate(setup.data, day.data, [], [], tankerInputs([r])).flags.filter((f) => f.code === "S6").length : 0;
  const earlier = (recent.data ?? []).filter((r) => r.dayId !== day.data?.id).slice(0, 5);
  const open = (r?: Receipt) =>
    router.push({ pathname: "/day/tanker", params: { date: r?.businessDate || date, ...(r ? { id: r.id } : {}) } });

  return (
    <>
      <MainHeader title="Tanker" subtitle={fmtDate(date, "weekday")} />
      <ScreenBody
        sticky={
          !loading && !failed && !locked ? (
            <StickyActionBar>
              <Button label="Add tanker" icon="plus" onPress={() => open()} />
            </StickyActionBar>
          ) : undefined
        }
      >
        {loading && !failed ? (
          <View className="gap-8">
            <Skeleton height={64} />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : failed || !day.data ? (
          <ErrorState
            title="Couldn't load tankers"
            body="Check the internet and try again."
            onRetry={() => {
              setup.refetch();
              day.refetch();
              tankers.refetch();
              recent.refetch();
            }}
          />
        ) : (
          <>
            {locked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}

            <View>
              <Text variant="label" tone="secondary">
                {isToday ? `Today · ${fmtDate(date, "short")}` : fmtDate(date, "weekday")}
              </Text>
              {list.length === 0 ? (
                <Text variant="body" tone="secondary" className="py-12">
                  No tanker added for this day.
                </Text>
              ) : (
                list.map((r) => {
                  const flags = flagsFor(r);
                  return (
                    <ListItem
                      key={r.id}
                      title={r.vehicleNo}
                      detail={`${receivedLine(r)} · received, after short`}
                      right={flags ? <StatusPill status="flag" label={`${flags} flag${flags === 1 ? "" : "s"}`} /> : undefined}
                      onPress={() => open(r)}
                    />
                  );
                })
              )}
            </View>

            {earlier.length > 0 ? (
              <View>
                <Text variant="label" tone="secondary">
                  Earlier
                </Text>
                {earlier.map((r) => (
                  <ListItem key={r.id} title={r.vehicleNo} detail={`${fmtDate(r.businessDate, "short")} · ${receivedLine(r)}`} onPress={() => open(r)} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScreenBody>
    </>
  );
}
