import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  BottomSheet,
  Button,
  Chip,
  ChipGroup,
  ErrorState,
  FieldError,
  FieldHint,
  FieldLabel,
  NumericInput,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  Text,
  TextField,
  useIsWide,
} from "@/components/ui";
import { CustomerPicker } from "@/features/day/CustomerPicker";
import { shiftNow } from "@/features/day/model";
import {
  useDay,
  useDaySetup,
  useDeleteExpense,
  useExpenses,
  useSalesSetup,
  useSaveExpense,
  useShiftData,
  type Day,
  type DaySetup,
  type ExpenseRow,
  type PaidFrom,
  type SalesSetup,
  type Shift,
} from "@/features/day/queries";
import { useDraftLoad, useKeepDraft } from "@/features/day/useDraft";
import { useMembership } from "@/features/session/SessionProvider";
import { track } from "@/lib/analytics";
import { Decimal } from "@/lib/decimal";
import { draftKey } from "@/lib/drafts";
import { formSaveError } from "@/lib/outbox";
import { fmtDate } from "@/lib/format";
import { readTypedNumber } from "@/lib/numberInput";
import { newId } from "@/lib/uuid";

const PAID_FROM: { value: PaidFrom; label: string }[] = [
  { value: "SHIFT_A", label: "Shift A cash drawer" },
  { value: "SHIFT_B", label: "Shift B cash drawer" },
  { value: "SHIFT_C", label: "Shift C cash drawer" },
  { value: "OWNER", label: "Owner paid" },
  { value: "BANK", label: "Bank" },
];
const CASH_ADVANCE = "cash advance to credit customer";

/** Add or fix an expense (canvas F7 "Add expense", PRD F8): what for, amount, paid from. */
export default function ExpenseScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date, id } = useLocalSearchParams<{ date: string; id?: string }>();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, date);
  const shifts = useShiftData(day.data?.id);
  const expenses = useExpenses(day.data?.id);
  const salesSetup = useSalesSetup(me.pump.id);
  // What was typed but not saved yet stays on the phone (D67).
  const keyOfDraft = draftKey("expense", me.pump.id, date ?? "", id ?? "new");
  const drafts = useDraftLoad<ExpenseDraft>(keyOfDraft);
  const [formNo, setFormNo] = useState(0);

  const failed = setup.error ?? day.error ?? shifts.error ?? expenses.error ?? salesSetup.error;
  const ready = setup.data && day.data && shifts.data && expenses.data && salesSetup.data && drafts.loaded;
  const existing = id ? expenses.data?.find((e) => e.id === id) : undefined;

  return (
    <>
      <ScreenHeader title={id ? "Expense" : "Add expense"} subtitle={date ? fmtDate(date, "weekday") : undefined} wide={wide} onBack={() => router.back()} />
      {failed ? (
        <ScreenBody>
          <ErrorState
            title="Couldn't load"
            body="Check the internet and try again."
            onRetry={() => (setup.refetch(), day.refetch(), shifts.refetch(), expenses.refetch(), salesSetup.refetch())}
          />
        </ScreenBody>
      ) : !ready ? (
        <ScreenBody>
          <Skeleton height={420} />
        </ScreenBody>
      ) : id && !existing ? (
        <ScreenBody>
          <ErrorState title="This expense isn't there any more" body="It may have been removed on another phone." onRetry={() => router.back()} />
        </ScreenBody>
      ) : (
        <ExpenseForm
          key={formNo}
          draftKey={keyOfDraft}
          draft={drafts.draft}
          onStartAgain={() => {
            drafts.forget();
            setFormNo((n) => n + 1);
          }}
          pumpId={me.pump.id}
          setup={setup.data}
          day={day.data}
          shifts={shifts.data.shifts}
          salesSetup={salesSetup.data}
          existing={existing}
          onDone={() => router.back()}
        />
      )}
    </>
  );
}

type ExpenseDraft = { expenseId: string; typeId: string | null; description: string; amount: string; paidFrom: PaidFrom; customerId: string | null };

function ExpenseForm({
  draftKey: keyOfDraft,
  draft,
  onStartAgain,
  pumpId,
  setup,
  day,
  shifts,
  salesSetup,
  existing,
  onDone,
}: {
  draftKey: string;
  draft: ExpenseDraft | null;
  onStartAgain: () => void;
  pumpId: string;
  setup: DaySetup;
  day: Day;
  shifts: Shift[];
  salesSetup: SalesSetup;
  existing?: ExpenseRow;
  onDone: () => void;
}) {
  const save = useSaveExpense(pumpId, day.id);
  const remove = useDeleteExpense(pumpId, day.id);
  const locked = day.isLocked;
  // The expense as saved (or empty); a draft from the phone goes on top of it. Paid from starts on the shift running now.
  const [base] = useState<ExpenseDraft>(() => ({
    expenseId: existing?.id ?? newId(),
    typeId: existing?.typeId ?? null,
    description: existing?.description ?? "",
    amount: existing ? existing.amount.replace(/\.00$/, "") : "",
    paidFrom: existing?.paidFrom ?? shiftNow(shifts, Date.now()),
    customerId: existing?.customerId ?? null,
  }));
  const start = draft ?? base;
  const [restored] = useState(Boolean(draft));
  const [expenseId] = useState(start.expenseId);
  const [typeId, setTypeId] = useState<string | null>(start.typeId);
  const [description, setDescription] = useState(start.description);
  const [amount, setAmount] = useState(start.amount);
  const [paidFrom, setPaidFrom] = useState<PaidFrom>(start.paidFrom);
  const [customerId, setCustomerId] = useState<string | null>(start.customerId);
  const [tried, setTried] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const discardDraft = useKeepDraft<ExpenseDraft>(keyOfDraft, { expenseId, typeId, description, amount, paidFrom, customerId }, base);

  const type = setup.expenseTypes.find((t) => t.id === typeId);
  const isOther = type?.name.toLowerCase() === "other";
  const isAdvance = type?.name.toLowerCase() === CASH_ADVANCE;
  const a = readTypedNumber(amount, 2);
  const problems = {
    type: !type ? "Pick what it was for." : undefined,
    description: isOther && !description.trim() ? "Write what it was." : undefined,
    amount: a.kind === "bad" ? a.message : a.kind === "empty" || new Decimal(a.value).lte(0) ? "Type the amount." : undefined,
  };
  const canSave = !Object.values(problems).some(Boolean) && !locked;

  const submit = () => {
    setTried(true);
    if (!canSave || !type || a.kind !== "ok") return;
    save.mutate(
      {
        id: expenseId,
        typeId: type.id,
        description: isOther ? description.trim() : null,
        amount: a.value,
        paidFrom,
        customerId: isAdvance ? customerId : null,
      },
      {
        onSuccess: () => {
          if (!existing) track("expense_added", { paid_from: paidFrom });
          discardDraft();
          onDone();
        },
      },
    );
  };

  return (
    <>
      <ScreenBody
        sticky={
          locked ? undefined : (
            <StickyActionBar
              note={
                tried && !canSave ? (
                  <Text variant="label" tone="danger" className="text-center">
                    Fix the red boxes to save
                  </Text>
                ) : undefined
              }
            >
              <Button label="Save expense" loading={save.isPending} onPress={submit} />
            </StickyActionBar>
          )
        }
      >
        {locked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}
        {restored && !locked ? (
          <Banner tone="info" icon="edit" title="Brought back what you typed" action={<Button label="Start again" size="M" variant="ghost" onPress={onStartAgain} />}>
            {"Not saved yet. Tap Save expense when it's done."}
          </Banner>
        ) : null}
        {save.error ? <Banner tone="danger" title={formSaveError(save.error.message)} /> : null}

        <View className="gap-8">
          <FieldLabel>What for</FieldLabel>
          <ChipGroup>
            {setup.expenseTypes.map((t) => (
              <Chip key={t.id} label={t.name} selected={t.id === typeId} onPress={locked ? undefined : () => setTypeId(t.id)} />
            ))}
          </ChipGroup>
          {tried && problems.type ? <FieldError message={problems.type} /> : null}
        </View>
        {isOther ? (
          <TextField
            label="Write what it was"
            value={description}
            onChangeText={setDescription}
            placeholder="Generator repair"
            capitalize="words"
            disabled={locked}
            error={tried ? problems.description : undefined}
          />
        ) : null}
        {isAdvance ? <CustomerPicker pumpId={pumpId} customers={salesSetup.customers} value={customerId} onChange={setCustomerId} disabled={locked} /> : null}
        <NumericInput
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          unit="₹"
          disabled={locked}
          error={tried || a.kind === "bad" ? problems.amount : undefined}
        />
        <View className="gap-8">
          <FieldLabel>Where did the money come from?</FieldLabel>
          <ChipGroup>
            {PAID_FROM.map((p) => (
              <Chip key={p.value} label={p.label} selected={p.value === paidFrom} onPress={locked ? undefined : () => setPaidFrom(p.value)} />
            ))}
          </ChipGroup>
          <FieldHint>Money from a shift&apos;s drawer is added back to that shift&apos;s sales, so the shift won&apos;t show as short.</FieldHint>
        </View>
        <Text variant="label" weight="400" tone="muted">
          Date is the day&apos;s date. Fixed or variable is set by the type.
        </Text>
        {existing && !locked ? <Button label="Remove this expense" variant="ghost" onPress={() => setConfirmRemove(true)} /> : null}
      </ScreenBody>

      <BottomSheet visible={confirmRemove} onClose={() => setConfirmRemove(false)}>
        <Text variant="heading">Remove this expense?</Text>
        <Text variant="body" tone="secondary">
          Only if it was added by mistake. The change is kept in the history.
        </Text>
        {remove.error ? <Banner tone="danger" title={remove.error.message} /> : null}
        <Button
          label="Remove expense"
          variant="destructive"
          loading={remove.isPending}
          onPress={() => existing && remove.mutate(existing.id, { onSuccess: () => (discardDraft(), setConfirmRemove(false), onDone()) })}
        />
        <Button label="Keep it" variant="secondary" onPress={() => setConfirmRemove(false)} />
      </BottomSheet>
    </>
  );
}
