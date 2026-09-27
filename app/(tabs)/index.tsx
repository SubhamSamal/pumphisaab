import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  DateStepper,
  ErrorState,
  PriceStrip,
  ProgressBar,
  ScreenBody,
  SectionCard,
  Skeleton,
  StatusPill,
  StickyActionBar,
  Text,
} from "@/components/ui";
import { daysNotSubmitted, evaluate, priceStrip, sectionsDone, shiftInputs, tankDays, todaySections, type Section } from "@/features/day/model";
import {
  useConfirmPrices,
  useDay,
  useDaySetup,
  useLockDay,
  useRecentDays,
  useShiftData,
  useTankReadings,
  useUnlockDay,
  type Day,
} from "@/features/day/queries";
import { useSaveState } from "@/features/day/saveState";
import { useSelectedDay } from "@/features/day/SelectedDay";
import { useMembership } from "@/features/session/SessionProvider";
import { MainHeader } from "@/features/shell/MainHeader";
import { track } from "@/lib/analytics";
import { addDays } from "@/lib/businessDay";
import { friendlyError } from "@/lib/errors";
import { fmtDate } from "@/lib/format";

/** How far back a manager can go (D49): today and the 2 days before. The owner can go back a year. */
const MANAGER_DAYS_BACK = 2;
const OWNER_DAYS_BACK = 366;

function daysAgo(today: string, date: string): string {
  const n = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
  return n === 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`;
}

export default function TodayScreen() {
  const me = useMembership();
  const router = useRouter();
  const pumpId = me.pump.id;
  const { today, serverKnown, date, isToday, setDate } = useSelectedDay();
  const isOwner = me.role === "owner";

  const setup = useDaySetup(pumpId);
  const day = useDay(pumpId, serverKnown ? date : undefined);
  const tanks = useTankReadings(day.data?.id);
  const shifts = useShiftData(day.data?.id);
  const recent = useRecentDays(pumpId, serverKnown ? today : undefined);
  const save = useSaveState();
  const confirm = useConfirmPrices(pumpId);
  const lock = useLockDay(pumpId);
  const unlock = useUnlockDay(pumpId);

  const dayId = day.data?.id;
  useEffect(() => {
    if (dayId) track("day_opened", { date, is_today: isToday });
  }, [dayId, date, isToday]);

  const minDate = addDays(today, -(isOwner ? OWNER_DAYS_BACK : MANAGER_DAYS_BACK));
  const loading = setup.isPending || day.isPending || tanks.isPending || shifts.isPending;
  const failed = setup.error ?? day.error ?? tanks.error ?? shifts.error;

  const model = useMemo(() => {
    if (!setup.data || !day.data || !tanks.data || !shifts.data) return null;
    const result = evaluate(
      setup.data,
      day.data,
      tankDays(setup.data, tanks.data.readings, tanks.data.yesterday),
      shiftInputs(setup.data, shifts.data),
    );
    const sections = todaySections(setup.data, day.data, tanks.data.readings, result, shifts.data);
    // Shift codes with a meter change waiting for the owner (H2), for the owner's banner.
    const pendingMeter = shifts.data.lines
      .filter((l) => l.meterChange === "PENDING")
      .map((l) => shifts.data.shifts.find((s) => s.id === l.shiftId)?.code ?? "");
    return { sections, done: sectionsDone(sections), price: priceStrip(setup.data, day.data), pendingMeter };
  }, [setup.data, day.data, tanks.data, shifts.data]);

  const late = isToday && setup.data && recent.data ? daysNotSubmitted(today, setup.data.firstBusinessDate, recent.data) : [];

  const openSection = (s: Section) => {
    if (!s.ready) return;
    track("section_opened", { section: s.key });
    if (s.key === "openingDip") router.push({ pathname: "/day/opening-dip", params: { date } });
    if (s.key === "shiftA" || s.key === "shiftB" || s.key === "shiftC") {
      router.push({ pathname: "/day/shift", params: { date, code: s.key.slice(-1) } });
    }
  };

  const submitNote = !model
    ? undefined
    : !day.data?.priceConfirmed
      ? "Confirm price and finish 8 sections"
      : `Finish ${8 - model.done} more section${8 - model.done === 1 ? "" : "s"} to submit`;

  return (
    <>
      <MainHeader title={me.pump.name} subtitle={fmtDate(date, "weekday")} />
      <ScreenBody
        sticky={
          model && !day.data?.isLocked ? (
            <StickyActionBar>
              {/* Submit arrives with the Review screen (slice 4f); until then it stays off and says what's left. */}
              <Button label={submitNote ?? "Submit"} disabled />
            </StickyActionBar>
          ) : undefined
        }
      >
        <DateStepper
          label={fmtDate(date, "weekday")}
          caption={daysAgo(today, date)}
          canPrevious={date > minDate}
          canNext={!isToday}
          onPrevious={() => setDate(addDays(date, -1))}
          onNext={() => setDate(addDays(date, 1))}
        />

        {late.length > 0 ? (
          <Banner
            tone="danger"
            title={
              late.length === 1
                ? `${late[0] === addDays(today, -1) ? `Yesterday (${fmtDate(late[0], "short")})` : fmtDate(late[0], "short")} isn't submitted`
                : `${late.map((d) => fmtDate(d, "short")).reverse().join(" and ")} aren't submitted`
            }
            action={<Button label={`Open ${fmtDate(late[late.length - 1], "short")}`} size="M" variant="secondary" onPress={() => setDate(late[late.length - 1])} />}
          >
            {`You can fill today, but you can submit it only after ${late.map((d) => fmtDate(d, "short")).reverse().join(" and ")}.`}
          </Banner>
        ) : null}

        {loading && !failed ? (
          <View className="gap-8">
            <Skeleton height={88} />
            <Skeleton height={28} />
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : failed || !model || !day.data ? (
          <ErrorState
            title="Couldn't open the day"
            body={friendlyError(failed, "Couldn't reach the server. Check the internet and try again. Nothing you typed is lost.")}
            onRetry={() => {
              setup.refetch();
              day.refetch();
              tanks.refetch();
              shifts.refetch();
            }}
          />
        ) : (
          <>
            <DayLockBanner
              day={day.data}
              isOwner={isOwner}
              busy={lock.isPending || unlock.isPending}
              error={(lock.error ?? unlock.error)?.message}
              onLock={() => lock.mutate(day.data.id, { onSuccess: () => track("day_locked", { date }) })}
              onUnlock={() => unlock.mutate(day.data.id, { onSuccess: () => track("day_unlocked", { date }) })}
            />

            {isOwner && model.pendingMeter.length > 0 ? (
              <Banner
                tone="warning"
                icon="edit"
                title={`${model.pendingMeter.length} meter change${model.pendingMeter.length === 1 ? "" : "s"} waiting for your approval`}
                action={
                  <Button
                    label={`Open Shift ${model.pendingMeter[0]}`}
                    size="M"
                    variant="secondary"
                    onPress={() => router.push({ pathname: "/day/shift", params: { date, code: model.pendingMeter[0] } })}
                  />
                }
              >
                A new opening was typed after a meter repair or replacement. Check it and tap Approve.
              </Banner>
            ) : null}

            {model.price.missing.length > 0 ? (
              <Banner tone="warning" title={`No ${model.price.missing.join(" or ")} price for ${fmtDate(date, "short")}`}>
                {isOwner ? "Add the price with its start date before the day can be matched." : "Ask the owner to add it."}
              </Banner>
            ) : null}
            {model.price.items.length > 0 && !(day.data.isLocked && model.price.state !== "confirmed") ? (
              <PriceStrip
                state={model.price.state}
                note={model.price.note}
                items={model.price.items}
                loading={confirm.isPending}
                disabled={model.price.missing.length > 0}
                onConfirm={() =>
                  confirm.mutate(day.data.id, { onSuccess: () => track("price_confirmed", { date, changed: model.price.state === "changed" }) })
                }
              />
            ) : null}
            {confirm.error ? <Banner tone="danger" title={confirm.error.message} /> : null}

            <ProgressBar
              done={model.done}
              total={8}
              left={<StatusPill status={day.data.isLocked ? "locked" : day.data.status === "SUBMITTED" ? "submitted" : "draft"} />}
              save={save}
            />
            <View className="gap-8">
              {model.sections.map((s) => (
                <SectionCard
                  key={s.key}
                  title={s.title}
                  subtitle={s.subtitle}
                  status={s.status}
                  errors={s.errors}
                  flags={s.flags}
                  onPress={s.ready ? () => openSection(s) : undefined}
                />
              ))}
            </View>
            <Text variant="label" weight="400" tone="muted">
              Sections marked &quot;Coming soon&quot; arrive over the next few updates.
            </Text>
          </>
        )}
      </ScreenBody>
    </>
  );
}

/** Locked / submitted / unlocked-by-owner state, with the owner's Lock and Unlock (D49). */
function DayLockBanner({
  day,
  isOwner,
  busy,
  error,
  onLock,
  onUnlock,
}: {
  day: Day;
  isOwner: boolean;
  busy: boolean;
  error?: string;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const problem = error ? <Banner tone="danger" title={error} /> : null;
  if (day.isLocked) {
    return (
      <>
        <Banner
          tone="info"
          icon="lock"
          title="This day is locked"
          action={isOwner ? <Button label="Unlock" icon="unlock" size="M" variant="secondary" loading={busy} onPress={onUnlock} /> : undefined}
        >
          {isOwner ? "Nothing can be changed. Unlock it to let a fix in; it stays open until you lock it again." : "Nothing can be changed. Ask the owner to unlock it."}
        </Banner>
        {problem}
      </>
    );
  }
  if (!isOwner || day.status === "DRAFT") return null;
  return (
    <>
      <Banner
        tone="info"
        title={day.ownerOpened ? "You unlocked this day" : "Submitted"}
        action={<Button label="Lock day" icon="lock" size="M" variant="secondary" loading={busy} onPress={onLock} />}
      >
        {day.ownerOpened
          ? "Managers can fix it until you lock it again."
          : "It locks by itself 3 days after its date. Lock it now if everything is checked."}
      </Banner>
      {problem}
    </>
  );
}
