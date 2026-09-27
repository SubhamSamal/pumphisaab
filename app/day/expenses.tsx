import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  KeyValueRow,
  ListItem,
  ScreenBody,
  ScreenHeader,
  Skeleton,
  StickyActionBar,
  useIsWide,
} from "@/components/ui";
import { expenseTotals, paidFromLabel } from "@/features/day/model";
import { useDay, useDaySetup, useExpenses, useSetDayAnswer, type ExpenseRow } from "@/features/day/queries";
import { useMembership } from "@/features/session/SessionProvider";
import { Decimal } from "@/lib/decimal";
import { fmtDate, fmtRupees } from "@/lib/format";

/** Expenses (canvas F7, PRD F8): every rupee paid out and where it came from, totals, "No expenses today". */
export default function ExpensesScreen() {
  const me = useMembership();
  const router = useRouter();
  const wide = useIsWide();
  const { date } = useLocalSearchParams<{ date: string }>();
  const setup = useDaySetup(me.pump.id);
  const day = useDay(me.pump.id, date);
  const expenses = useExpenses(day.data?.id);
  const answer = useSetDayAnswer(me.pump.id, day.data?.id);

  const failed = setup.error ?? day.error ?? expenses.error;
  const ready = setup.data && day.data && expenses.data;
  const locked = Boolean(day.data?.isLocked);
  const rows = expenses.data ?? [];
  const open = (e?: ExpenseRow) => router.push({ pathname: "/day/expense", params: { date, ...(e ? { id: e.id } : {}) } });

  // S9: types over their daily limit (only types with a limit, D72); same rule as the engine's checkExpenseCaps.
  const overLimit = new Set(
    (setup.data?.expenseTypes ?? [])
      .filter((t) => t.dailyCap !== null && rows.filter((e) => e.typeId === t.id).reduce((s, e) => s.plus(e.amount), new Decimal(0)).gt(t.dailyCap as string))
      .map((t) => t.id),
  );
  const typeName = (e: ExpenseRow) => setup.data?.expenseTypes.find((t) => t.id === e.typeId)?.name ?? "Expense";
  const capOf = (e: ExpenseRow) => setup.data?.expenseTypes.find((t) => t.id === e.typeId)?.dailyCap;
  const totals = expenseTotals(rows);

  return (
    <>
      <ScreenHeader title="Expenses" subtitle={date ? fmtDate(date, "weekday") : undefined} wide={wide} onBack={() => router.back()} />
      {failed ? (
        <ScreenBody>
          <ErrorState title="Couldn't load expenses" body="Check the internet and try again." onRetry={() => (setup.refetch(), day.refetch(), expenses.refetch())} />
        </ScreenBody>
      ) : !ready ? (
        <ScreenBody>
          <Skeleton height={220} />
        </ScreenBody>
      ) : (
        <ScreenBody
          sticky={
            locked ? undefined : (
              <StickyActionBar>
                <Button label="Add expense" icon="plus" onPress={() => open()} />
              </StickyActionBar>
            )
          }
        >
          {locked ? <Banner tone="info" icon="lock" title="This day is locked" /> : null}
          {answer.error ? <Banner tone="danger" title={answer.error.message} /> : null}

          {rows.length === 0 ? (
            day.data.noExpenses ? (
              <EmptyState
                icon="check"
                title="No expenses today"
                body="The Expenses section is done. Add one if something was paid out after all."
                secondary={locked ? undefined : { label: "Undo", onPress: () => answer.mutate({ field: "no_expenses", value: false }) }}
              />
            ) : (
              <EmptyState
                icon="wallet"
                title="Nothing paid out yet"
                body="Add every rupee paid out today, and where it came from."
                secondary={locked ? undefined : { label: "No expenses today", onPress: () => answer.mutate({ field: "no_expenses", value: true }) }}
              />
            )
          ) : (
            <>
              <View>
                {rows.map((e) => {
                  const name = typeName(e);
                  const cap = capOf(e);
                  return (
                    <ListItem
                      key={e.id}
                      title={name.toLowerCase() === "other" && e.description ? e.description : name}
                      detail={name.toLowerCase() === "other" ? `Other · ${paidFromLabel(e.paidFrom)}` : paidFromLabel(e.paidFrom)}
                      warning={overLimit.has(e.typeId) && cap ? `More than the ${fmtRupees(cap)} daily limit` : undefined}
                      right={fmtRupees(e.amount)}
                      onPress={locked ? undefined : () => open(e)}
                    />
                  );
                })}
              </View>
              <Card tone="summary">
                <KeyValueRow label="From shift cash" value={fmtRupees(totals.fromShifts)} />
                <KeyValueRow label="Paid by owner or bank" value={fmtRupees(totals.byOwnerOrBank)} />
                <Divider />
                <KeyValueRow label="Total today" value={fmtRupees(totals.total)} big />
              </Card>
            </>
          )}
        </ScreenBody>
      )}
    </>
  );
}
