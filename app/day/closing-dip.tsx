import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  AutoValueRow,
  Banner,
  Button,
  Card,
  DipInput,
  ErrorState,
  ProductTag,
  SaveIndicator,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  Text,
  useIsWide,
} from "@/components/ui";
import { checkChart, dipToLitres, type DayResult } from "@/calc";
import { activeTanks, evaluate, issuesForTank, tankDays, tankerInputs, type TypedTank } from "@/features/day/model";
import {
  useDay,
  useDaySetup,
  useSaveTankReading,
  useTankers,
  useTankersFromYesterday,
  useTankReadings,
  type Day,
  type DaySetup,
  type Receipt,
  type SetupTank,
  type TankReading,
  type TankYesterday,
} from "@/features/day/queries";
import { useSaveState } from "@/features/day/saveState";
import { useMembership } from "@/features/session/SessionProvider";
import { track } from "@/lib/analytics";
import { Decimal } from "@/lib/decimal";
import { fmtDate, fmtLitres, MINUS } from "@/lib/format";
import { readTypedNumber } from "@/lib/numberInput";

const FUEL_NAME = { HSD: "Diesel", MS: "Petrol" } as const;

/** Closing dip (canvas F3 "End of day", PRD F9): dip cm → litres, and "Sold today as per tank" with the sum written out. */
export default function ClosingDipScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date } = useLocalSearchParams<{ date: string }>();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, date);
  const tanks = useTankReadings(day.data?.id);
  const tankers = useTankers(day.data?.id);
  const fromYesterday = useTankersFromYesterday(me.pump.id, date);
  const save = useSaveState();

  const failed = setup.error ?? day.error ?? tanks.error ?? tankers.error ?? fromYesterday.error;
  const ready = setup.data && day.data && tanks.data && tankers.data && fromYesterday.data;

  return (
    <>
      <ScreenHeader
        title="Closing dip"
        subtitle={date ? fmtDate(date, "weekday") : undefined}
        wide={wide}
        onBack={() => router.back()}
        right={ready ? <SaveIndicator state={save.state} waiting={save.waiting} /> : undefined}
      />
      {failed ? (
        <ScreenBody>
          <ErrorState
            title="Couldn't load the dips"
            body="Check the internet and try again. Nothing you typed is lost."
            onRetry={() => (setup.refetch(), day.refetch(), tanks.refetch(), tankers.refetch(), fromYesterday.refetch())}
          />
        </ScreenBody>
      ) : !ready ? (
        <ScreenBody>
          <Skeleton height={240} />
          <Skeleton height={240} />
        </ScreenBody>
      ) : (
        <ClosingDipForm
          pumpId={me.pump.id}
          setup={setup.data}
          day={day.data}
          readings={tanks.data.readings}
          yesterday={tanks.data.yesterday}
          receipts={tankers.data}
          fromYesterday={fromYesterday.data}
          onDone={() => router.back()}
          onReview={() => router.replace({ pathname: "/day/review", params: { date } })}
        />
      )}
    </>
  );
}

const closingOf = (readings: TankReading[], tankId: string) => readings.find((r) => r.tankId === tankId && r.type === "CLOSING");

function ClosingDipForm({
  pumpId,
  setup,
  day,
  readings,
  yesterday,
  receipts,
  fromYesterday,
  onDone,
  onReview,
}: {
  pumpId: string;
  setup: DaySetup;
  day: Day;
  readings: TankReading[];
  yesterday: TankYesterday[];
  receipts: Receipt[];
  fromYesterday: Receipt[];
  onDone: () => void;
  onReview: () => void;
}) {
  const saveReading = useSaveTankReading(pumpId, day.id);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(activeTanks(setup).map((t) => [t.id, closingOf(readings, t.id)?.dipCm ?? ""])),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  const typed = useMemo(() => {
    const out: Record<string, TypedTank> = {};
    for (const [tankId, v] of Object.entries(values)) {
      const dip = readTypedNumber(v, 1);
      out[tankId] = { closingDipCm: dip.kind === "ok" ? dip.value : null };
    }
    return out;
  }, [values]);
  const result: DayResult = useMemo(
    () => evaluate(setup, day, tankDays(setup, readings, yesterday, typed), [], tankerInputs(receipts), [], [], tankerInputs(fromYesterday)),
    [setup, day, readings, yesterday, typed, receipts, fromYesterday],
  );

  const tanks = activeTanks(setup);
  const allDone = tanks.every((t) => typed[t.id]?.closingDipCm) && !result.hardErrors.some((e) => e.code === "H3");
  useEffect(() => {
    for (const e of result.hardErrors) if (e.code === "H3") track("hard_error_shown", { rule_code: "H3", section: "closingDip" });
  }, [result.hardErrors]);

  const commit = (tank: SetupTank) => {
    const dip = readTypedNumber(values[tank.id], 1);
    if (dip.kind === "bad") return;
    if (issuesForTank(result.hardErrors, tank.id).some((e) => e.code === "H3")) return; // the database would refuse it too
    const saved = closingOf(readings, tank.id);
    const next = dip.kind === "ok" ? dip.value : null;
    if (next === null ? saved?.dipCm == null : saved?.dipCm != null && new Decimal(next).equals(saved.dipCm)) return;
    setSaveError(null);
    saveReading.mutate(
      { tankId: tank.id, type: "CLOSING", dipCm: next, bookStockLitres: null, version: saved?.version },
      {
        onSuccess: () => track("field_autosaved", { section: "closingDip" }),
        onError: (e) => {
          track("draft_save_failed", { section: "closingDip" });
          setSaveError(e.message);
        },
      },
    );
  };

  const finish = () => {
    if (!allDone) return onDone();
    track("section_completed", { section: "closingDip", duration_sec: Math.round((Date.now() - openedAt) / 1000) });
    onReview();
  };

  return (
    <ScreenBody
      sticky={
        <StickyActionBar>
          <Button label={allDone ? "Done · Next: Review" : "Back to Today"} onPress={finish} variant={allDone ? "primary" : "secondary"} />
        </StickyActionBar>
      }
    >
      {day.isLocked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}
      {saveError ? <Banner tone="danger" title={saveError} /> : null}
      {tanks.map((tank) => (
        <ClosingCard
          key={tank.id}
          tank={tank}
          setup={setup}
          value={values[tank.id]}
          locked={day.isLocked}
          result={result}
          hasOpening={readings.some((r) => r.tankId === tank.id && r.type === "OPENING" && r.dipCm !== null)}
          onChange={(v) => setValues((cur) => ({ ...cur, [tank.id]: v }))}
          onBlur={() => commit(tank)}
        />
      ))}
    </ScreenBody>
  );
}

/** "Opening 14,820 + tanker 11,980 − closing 18,681" (canvas F3): the sum behind "sold as per tank". */
export function soldSum(opening: Decimal, tanker: Decimal, closing: Decimal) {
  const n = (d: Decimal) => fmtLitres(d).replace(/ L$/, "");
  return `Opening ${n(opening)}${tanker.isZero() ? "" : ` + tanker ${n(tanker)}`} ${MINUS} closing ${n(closing)}`;
}

function ClosingCard({
  tank,
  setup,
  value,
  locked,
  result,
  hasOpening,
  onChange,
  onBlur,
}: {
  tank: SetupTank;
  setup: DaySetup;
  value: string;
  locked: boolean;
  result: DayResult;
  hasOpening: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const chart = useMemo(() => checkChart(setup.charts[tank.chartId] ?? []).chart, [setup.charts, tank.chartId]);
  const dip = readTypedNumber(value, 1);
  const litres = chart && dip.kind === "ok" ? dipToLitres(chart, dip.value) : null;

  // H3: outside the chart; if a decimal point looks missed, suggest the likely reading (canvas F3 "Typo").
  const h3 = chart && dip.kind === "ok" && litres === null;
  let dipError = dip.kind === "bad" ? dip.message : h3 && chart ? `This tank only goes up to ${chart.maxDipCm.toFixed(1)} cm.` : undefined;
  if (h3 && chart && dip.kind === "ok") {
    const guess = new Decimal(dip.value).div(10).toDecimalPlaces(1);
    if (guess.gt(0) && dipToLitres(chart, guess.toString()) !== null) dipError = `${dipError} Did you mean ${guess.toFixed(1)}?`;
  }
  const product = result.products.find((p) => p.product === tank.product);

  return (
    <Card>
      <View className="flex-row items-center gap-8">
        <ProductTag product={tank.product} />
        <Text variant="heading">
          {FUEL_NAME[tank.product]} tank {tank.label}
        </Text>
      </View>
      <DipInput label="Closing dip reading" cm={value} onChangeCm={onChange} onBlur={onBlur} litres={litres ? fmtLitres(litres) : undefined} error={dipError} disabled={locked} />
      {product && !h3 ? (
        <View className="gap-4">
          <AutoValueRow label="Sold today as per tank" value={fmtLitres(product.soldAsPerTank)} />
          <Text variant="label" weight="400" tone="secondary">
            {soldSum(product.openingDipLitres, product.receivedLitres, product.closingDipLitres)}
          </Text>
        </View>
      ) : !hasOpening ? (
        <Text variant="label" weight="400" tone="warning">
          The opening dip isn&apos;t typed yet, so sold as per tank can&apos;t be worked out.
        </Text>
      ) : null}
    </Card>
  );
}
