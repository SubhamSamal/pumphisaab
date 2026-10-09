import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  DifferenceValue,
  Divider,
  ErrorState,
  KeyValueRow,
  ProductTag,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StatusPill,
  StickyActionBar,
  SummaryGroup,
  Text,
  useIsWide,
} from "@/components/ui";
import { reviewModel, type ReviewModel, type ReviewTarget } from "@/features/day/model";
import { useSetDayAnswer, useSubmitDay, type Day } from "@/features/day/queries";
import { useSelectedDay } from "@/features/day/SelectedDay";
import { useWholeDay } from "@/features/day/useWholeDay";
import { useMembership } from "@/features/session/SessionProvider";
import { track } from "@/lib/analytics";
import { addDays } from "@/lib/businessDay";
import { fmtDate, fmtLitres, fmtRupees } from "@/lib/format";

type Step = 1 | 2 | 3 | "done";
const STEP_TITLE = { 1: "Fuel", 2: "Money", 3: "Summary" } as const;

/** Review and submit (canvas F8, PRD F12): 1 Fuel, 2 Money, 3 Summary (red / yellow / green, owner 29 Sep), then Submit. */
export default function ReviewScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { today, setDate } = useSelectedDay();
  const whole = useWholeDay(me.pump.id, date);
  const submit = useSubmitDay(me.pump.id);
  const answer = useSetDayAnswer(me.pump.id, whole.model?.day.id);
  const [step, setStep] = useState<Step>(1);
  const [openedAt] = useState(() => Date.now());

  const m = whole.model;
  const review = m ? reviewModel(m.setup, m.day, m.result, m.sections, m.receipts, m.shifts.shifts) : null;

  useEffect(() => {
    if (step === 3 && m) for (const e of m.result.hardErrors) track("hard_error_shown", { rule_code: e.code, section: "review" });
    // Only when step 3 opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const go = (target: ReviewTarget) => {
    if (target === "today" || target === "sales") return router.navigate(target === "today" ? "/" : "/sales");
    if (target === "tanker") return router.navigate("/tanker");
    if (target === "openingDip") return router.push({ pathname: "/day/opening-dip", params: { date } });
    if (target === "closingDip") return router.push({ pathname: "/day/closing-dip", params: { date } });
    if (target === "expenses") return router.push({ pathname: "/day/expenses", params: { date } });
    return router.push({ pathname: "/day/shift", params: { date, code: target.slice(-1) } });
  };

  const doSubmit = () => {
    if (!m || !review) return;
    submit.mutate(m.day.id, {
      onSuccess: ({ isMatched }) => {
        track("day_submitted", { is_matched: isMatched, total_entry_sec: Math.round((Date.now() - openedAt) / 1000), open_flags: review.yellow.length });
        setStep("done");
      },
    });
  };

  const title = step === "done" ? "Submitted" : `Review · ${date ? fmtDate(date, "short") : ""}`;
  return (
    <>
      <ScreenHeader
        title={title}
        subtitle={step === "done" ? undefined : `${step} of 3 · ${STEP_TITLE[step]}`}
        wide={wide}
        onBack={() => (typeof step === "number" && step > 1 ? setStep((step - 1) as Step) : router.back())}
      />
      {whole.failed ? (
        <ScreenBody>
          <ErrorState title="Couldn't load the day" body="Check the internet and try again. Nothing you typed is lost." onRetry={whole.refetch} />
        </ScreenBody>
      ) : !m || !review ? (
        <ScreenBody>
          <Skeleton height={240} />
          <Skeleton height={240} />
        </ScreenBody>
      ) : step === "done" ? (
        <Submitted
          day={m.day}
          review={review}
          today={today}
          onStartNext={() => {
            setDate(addDays(m.day.businessDate, 1));
            router.navigate("/");
          }}
          onBack={() => router.navigate("/")}
        />
      ) : (
        <ScreenBody
          sticky={
            <StickyActionBar
              note={
                step === 3 && !review.canSubmit ? (
                  <Text variant="label" tone="danger" className="text-center">
                    {m.day.isLocked ? "This day is locked" : "Clear the red list above to submit"}
                  </Text>
                ) : undefined
              }
            >
              {step === 3 ? (
                <Button
                  label={m.day.status === "DRAFT" ? "Submit day" : "Submit again"}
                  icon="send"
                  loading={submit.isPending}
                  disabled={!review.canSubmit}
                  onPress={doSubmit}
                />
              ) : (
                <Button label={`Next: ${STEP_TITLE[(step + 1) as 2 | 3]}`} onPress={() => setStep((step + 1) as Step)} />
              )}
            </StickyActionBar>
          }
        >
          {m.day.status !== "DRAFT" && !m.day.isLocked ? (
            <Banner tone="info" title="Already submitted">
              Submit again after a fix to update the result. The first submit time is kept.
            </Banner>
          ) : null}
          {step === 1 ? <FuelStep review={review} /> : null}
          {step === 2 ? <MoneyStep review={review} /> : null}
          {step === 3 ? (
            <SummaryStep
              review={review}
              answering={answer.isPending}
              answerError={answer.error?.message}
              onNoTanker={() => answer.mutate({ field: "no_tanker", value: true })}
              onAddTanker={() => go("tanker")}
              submitError={submit.error?.message}
              onGo={go}
            />
          ) : null}
        </ScreenBody>
      )}
    </>
  );
}

function FuelStep({ review }: { review: ReviewModel }) {
  return (
    <>
      <Text variant="heading">Fuel: tank vs meters</Text>
      {review.fuels.map((f) => (
        <Card key={f.product}>
          <View className="flex-row items-center gap-8">
            <ProductTag product={f.product} />
            <Text variant="heading">{f.name}</Text>
          </View>
          <KeyValueRow label="Sold as per tank (dip)" value={fmtLitres(f.soldAsPerTank)} />
          <KeyValueRow label="Sold as per meters" value={fmtLitres(f.soldAsPerMeters)} />
          <Divider />
          {/* The pill always sits under the word, so every fuel looks the same (owner, 09 Oct). */}
          <View className="gap-8">
            <Text variant="body" weight="600">
              Difference
            </Text>
            <DifferenceValue value={f.difference} unit="litres" percentOf={f.soldAsPerTank} withinLimit={f.withinLimit} />
          </View>
          <Text variant="label" weight="400" tone="secondary">
            {f.note}
          </Text>
        </Card>
      ))}
      {review.fuelsWaiting.length ? (
        <Banner tone="warning" title={`${review.fuelsWaiting.join(" and ")}: can't be worked out yet`}>
          Both dips are needed (opening and closing).
        </Banner>
      ) : null}
    </>
  );
}

function MoneyStep({ review }: { review: ReviewModel }) {
  return (
    <>
      <Text variant="heading">Money: should have vs received</Text>
      {review.shifts.map((s) => (
        <Card key={s.shift}>
          <View className="flex-row flex-wrap items-center justify-between gap-8">
            <Text variant="heading">{`Shift ${s.shift}`}</Text>
            <DifferenceValue value={s.difference} unit="rupees" withinLimit={s.withinLimit} />
          </View>
          <KeyValueRow label="Should have" value={fmtRupees(s.shouldHave)} />
          <KeyValueRow label="Received" value={fmtRupees(s.received)} />
        </Card>
      ))}
      {review.shifts.length < 3 ? (
        <Banner tone="warning" title="Some shifts can't be worked out yet">
          Each shift needs its readings, the price confirmed and the cash counted.
        </Banner>
      ) : null}
      {review.dayTotal ? (
        <Card tone="summary">
          <View className="flex-row flex-wrap items-center justify-between gap-8">
            <Text variant="heading">Day total</Text>
            <DifferenceValue value={review.dayTotal} unit="rupees" />
          </View>
        </Card>
      ) : null}
    </>
  );
}

function SummaryStep({
  review,
  answering,
  answerError,
  onNoTanker,
  onAddTanker,
  submitError,
  onGo,
}: {
  review: ReviewModel;
  answering: boolean;
  answerError?: string;
  onNoTanker: () => void;
  onAddTanker: () => void;
  submitError?: string;
  onGo: (t: ReviewTarget) => void;
}) {
  const lines = (list: ReviewModel["red"]) => list.map((l, i) => ({ key: `${i}`, text: l.text, onPress: l.target ? () => onGo(l.target as ReviewTarget) : undefined }));
  return (
    <>
      {submitError ? <Banner tone="danger" title={submitError} /> : null}
      {review.askNoTanker ? (
        <Banner
          tone="danger"
          title="Did no tanker come today?"
          action={
            <>
              <Button label="Yes, none came" size="M" variant="secondary" loading={answering} onPress={onNoTanker} />
              <Button label="Add tanker" size="M" variant="secondary" onPress={onAddTanker} />
            </>
          }
        >
          Answer this to submit.
        </Banner>
      ) : null}
      {answerError ? <Banner tone="danger" title={answerError} /> : null}
      <SummaryGroup tone="red" title="Fix these to submit" lines={lines(review.red)} />
      <SummaryGroup tone="yellow" title="Minor. You can submit; the owner will see these" lines={lines(review.yellow)} />
      <SummaryGroup tone="green" title="Checks passed" lines={lines(review.green)} />
      <Card tone="summary">
        <Text variant="label" tone="secondary">
          The owner gets
        </Text>
        <Text variant="body" weight="600">{`"${review.ownerMessage}"`}</Text>
      </Card>
    </>
  );
}

function Submitted({ day, review, today, onStartNext, onBack }: { day: Day; review: ReviewModel; today: string; onStartNext: () => void; onBack: () => void }) {
  const next = addDays(day.businessDate, 1);
  const nextStarted = next <= today;
  return (
    <ScreenBody
      sticky={
        <StickyActionBar>
          {nextStarted ? <Button label={`Start ${fmtDate(next, "short")}`} onPress={onStartNext} /> : <Button label="Back to Today" onPress={onBack} />}
        </StickyActionBar>
      }
    >
      <Card>
        <View className="flex-row flex-wrap items-center justify-between gap-8">
          <Text variant="heading">{`${fmtDate(day.businessDate, "short")} submitted`}</Text>
          <StatusPill status="submitted" />
        </View>
        {review.fuels.map((f) => (
          <View key={f.product} className="flex-row flex-wrap items-center justify-between gap-8">
            <ProductTag product={f.product} />
            <DifferenceValue value={f.difference} unit="litres" withinLimit={f.withinLimit} look="inline" />
          </View>
        ))}
        {review.dayTotal ? (
          <View className="flex-row flex-wrap items-center justify-between gap-8">
            <Text variant="body" weight="600">
              Money
            </Text>
            <DifferenceValue value={review.dayTotal} unit="rupees" look="inline" />
          </View>
        ) : null}
        <Text variant="label" weight="400" tone="secondary">
          {review.yellow.length ? `${review.yellow.length} minor point${review.yellow.length === 1 ? "" : "s"} for the owner.` : "Nothing for the owner to check."}
        </Text>
      </Card>
      <Text variant="body" tone="secondary">
        You can still fix a number until the owner locks the day. Every change is logged.
      </Text>
      {!nextStarted ? (
        <Text variant="label" weight="400" tone="muted">
          {`${fmtDate(next, "short")} starts at 6 AM.`}
        </Text>
      ) : null}
    </ScreenBody>
  );
}
