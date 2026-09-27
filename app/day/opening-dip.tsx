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
  FlagNote,
  NumericInput,
  ProductTag,
  SaveIndicator,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  Text,
  useIsWide,
} from "@/components/ui";
import { dipToLitres, checkChart, type DayResult } from "@/calc";
import { activeTanks, evaluate, issuesForTank, tankDays, type TypedTank } from "@/features/day/model";
import {
  useDay,
  useDaySetup,
  useSaveTankReading,
  useTankReadings,
  type DaySetup,
  type SetupTank,
  type TankReading,
  type TankYesterday,
} from "@/features/day/queries";
import { useSaveState } from "@/features/day/saveState";
import { useMembership } from "@/features/session/SessionProvider";
import { track } from "@/lib/analytics";
import { Decimal } from "@/lib/decimal";
import { fmtDate, fmtDip, fmtLitres, MINUS } from "@/lib/format";
import { readTypedNumber } from "@/lib/numberInput";

const FUEL_NAME = { HSD: "Diesel", MS: "Petrol" } as const;

/** Opening dip (canvas F3, PRD F3): per tank, IOCL report stock (optional, D48) and dip cm → litres. */
export default function OpeningDipScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date } = useLocalSearchParams<{ date: string }>();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, date);
  const tanks = useTankReadings(day.data?.id);
  const save = useSaveState();

  const failed = setup.error ?? day.error ?? tanks.error;
  const ready = setup.data && day.data && tanks.data;

  return (
    <>
      <ScreenHeader
        title="Opening dip"
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
            onRetry={() => {
              setup.refetch();
              day.refetch();
              tanks.refetch();
            }}
          />
        </ScreenBody>
      ) : !ready ? (
        <ScreenBody>
          <Skeleton height={280} />
          <Skeleton height={280} />
        </ScreenBody>
      ) : (
        <OpeningDipForm
          pumpId={me.pump.id}
          setup={setup.data}
          dayId={day.data.id}
          locked={day.data.isLocked}
          priceConfirmed={day.data.priceConfirmed}
          businessDate={day.data.businessDate}
          readings={tanks.data.readings}
          yesterday={tanks.data.yesterday}
          onDone={() => router.back()}
          refetch={() => tanks.refetch()}
        />
      )}
    </>
  );
}

type Values = Record<string, { dip: string; book: string }>;

function valuesFrom(setup: DaySetup, readings: TankReading[]): Values {
  const out: Values = {};
  for (const t of activeTanks(setup)) {
    const r = readings.find((x) => x.tankId === t.id && x.type === "OPENING");
    out[t.id] = { dip: r?.dipCm ?? "", book: r?.bookStockLitres ?? "" };
  }
  return out;
}

const sameNumber = (a: string | null, b: string | null) => (a === null || b === null ? a === b : new Decimal(a).equals(new Decimal(b)));

function OpeningDipForm({
  pumpId,
  setup,
  dayId,
  locked,
  priceConfirmed,
  businessDate,
  readings,
  yesterday,
  onDone,
  refetch,
}: {
  pumpId: string;
  setup: DaySetup;
  dayId: string;
  locked: boolean;
  priceConfirmed: boolean;
  businessDate: string;
  readings: TankReading[];
  yesterday: TankYesterday[];
  onDone: () => void;
  refetch: () => Promise<{ data?: { readings: TankReading[] } }>;
}) {
  const saveReading = useSaveTankReading(pumpId, dayId);
  const [values, setValues] = useState<Values>(() => valuesFrom(setup, readings));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  // What the engine sees: every valid typed number (a half-typed or wrong number counts as empty).
  const typed = useMemo(() => {
    const out: Record<string, TypedTank> = {};
    for (const [tankId, v] of Object.entries(values)) {
      const dip = readTypedNumber(v.dip, 1);
      const book = readTypedNumber(v.book, 2);
      out[tankId] = { openingDipCm: dip.kind === "ok" ? dip.value : null, bookStockLitres: book.kind === "ok" ? book.value : null };
    }
    return out;
  }, [values]);
  const result: DayResult = useMemo(
    () =>
      evaluate(
        setup,
        { id: dayId, businessDate, priceConfirmed, status: "DRAFT", isLocked: locked, ownerOpened: false, confirmed: {}, now: {}, noTanker: false, noExpenses: false, isMatched: null, submittedAt: null, version: 0 },
        tankDays(setup, readings, yesterday, typed),
      ),
    [setup, dayId, businessDate, priceConfirmed, locked, readings, yesterday, typed],
  );

  const allDone = activeTanks(setup).every((t) => typed[t.id]?.openingDipCm) && result.hardErrors.every((e) => e.code !== "H3");
  useEffect(() => {
    for (const e of result.hardErrors) if (e.code === "H3") track("hard_error_shown", { rule_code: "H3", section: "openingDip" });
  }, [result.hardErrors]);

  const commit = (tank: SetupTank) => {
    const v = values[tank.id];
    const dip = readTypedNumber(v.dip, 1);
    const book = readTypedNumber(v.book, 2);
    if (dip.kind === "bad" || book.kind === "bad") return; // the box shows what to fix
    if (issuesForTank(result.hardErrors, tank.id).some((e) => e.code === "H3")) return; // the database would refuse it too
    const saved = readings.find((r) => r.tankId === tank.id && r.type === "OPENING");
    const newDip = dip.kind === "ok" ? dip.value : null;
    const newBook = book.kind === "ok" ? book.value : null;
    if (sameNumber(newDip, saved?.dipCm ?? null) && sameNumber(newBook, saved?.bookStockLitres ?? null)) return;
    setSaveError(null);
    saveReading.mutate(
      { tankId: tank.id, type: "OPENING", dipCm: newDip, bookStockLitres: newBook, version: saved?.version },
      {
        onSuccess: () => track("field_autosaved", { section: "openingDip" }),
        onError: (e) => {
          track("draft_save_failed", { section: "openingDip" });
          setSaveError(e.message);
          // Someone else saved first: show their numbers instead of overwriting them.
          if ((e.cause as { code?: string } | undefined)?.code === "40001") {
            refetch().then((r) => r.data && setValues((cur) => ({ ...cur, [tank.id]: valuesFrom(setup, r.data!.readings)[tank.id] })));
          }
        },
      },
    );
  };

  const finish = () => {
    if (allDone) track("section_completed", { section: "openingDip", duration_sec: Math.round((Date.now() - openedAt) / 1000) });
    onDone();
  };

  return (
    <ScreenBody
      sticky={
        <StickyActionBar>
          <Button label={allDone ? "Done" : "Back to Today"} onPress={finish} variant={allDone ? "primary" : "secondary"} />
        </StickyActionBar>
      }
    >
      {locked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}
      {saveError ? <Banner tone="danger" title={saveError} /> : null}
      {activeTanks(setup).map((tank) => (
        <TankCard
          key={tank.id}
          tank={tank}
          setup={setup}
          value={values[tank.id]}
          locked={locked}
          result={result}
          yesterday={yesterday.find((y) => y.tankId === tank.id)}
          onChange={(v) => setValues((cur) => ({ ...cur, [tank.id]: v }))}
          onBlur={() => commit(tank)}
        />
      ))}
    </ScreenBody>
  );
}

function TankCard({
  tank,
  setup,
  value,
  locked,
  result,
  yesterday,
  onChange,
  onBlur,
}: {
  tank: SetupTank;
  setup: DaySetup;
  value: { dip: string; book: string };
  locked: boolean;
  result: DayResult;
  yesterday?: TankYesterday;
  onChange: (v: { dip: string; book: string }) => void;
  onBlur: () => void;
}) {
  const chart = useMemo(() => checkChart(setup.charts[tank.chartId] ?? []).chart, [setup.charts, tank.chartId]);
  const dip = readTypedNumber(value.dip, 1);
  const book = readTypedNumber(value.book, 2);
  const litres = chart && dip.kind === "ok" ? dipToLitres(chart, dip.value) : null;

  // H3 comes from the engine; if a decimal point looks missed, suggest the likely reading.
  const h3 = issuesForTank(result.hardErrors, tank.id).find((e) => e.code === "H3");
  let dipError = dip.kind === "bad" ? dip.message : h3?.message;
  if (h3 && chart && dip.kind === "ok") {
    const guess = new Decimal(dip.value).div(10).toDecimalPlaces(1);
    if (dipToLitres(chart, guess.toString()) !== null && guess.gt(0)) dipError = `${dipError} Did you mean ${guess.toFixed(1)}?`;
  }

  const flags = issuesForTank(result.flags, tank.id).filter((f) => f.code === "S3" || f.code === "S7");
  const gap = litres && book.kind === "ok" ? litres.minus(book.value) : null;

  return (
    <Card>
      <View className="flex-row items-center gap-8">
        <ProductTag product={tank.product} />
        <Text variant="heading">
          {FUEL_NAME[tank.product]} tank {tank.label}
        </Text>
      </View>
      <NumericInput
        label="IOCL report stock (optional)"
        value={value.book}
        onChangeText={(t) => onChange({ ...value, book: t })}
        onBlur={onBlur}
        unit="L"
        disabled={locked}
        error={book.kind === "bad" ? book.message : undefined}
      />
      <DipInput
        cm={value.dip}
        onChangeCm={(t) => onChange({ ...value, dip: t })}
        onBlur={onBlur}
        litres={litres ? fmtLitres(litres) : undefined}
        reference={yesterday?.closingDipCm ? `Last night's closing dip: ${fmtDip(yesterday.closingDipCm)}` : undefined}
        error={dipError}
      />
      {gap ? (
        <AutoValueRow
          label="Difference from IOCL"
          value={gap.isZero() ? "0 L" : `${gap.isNegative() ? MINUS : "+"}${fmtLitres(gap.abs())}`}
        />
      ) : null}
      {flags.map((f) => (
        <FlagNote key={f.code}>{f.message}</FlagNote>
      ))}
    </Card>
  );
}
