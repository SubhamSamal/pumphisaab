import { useMemo } from "react";
import {
  customerPaymentInputs,
  evaluate,
  expenseInputs,
  shiftInputs,
  tankDays,
  tankerInputs,
  todaySections,
  type SalesBundle,
} from "./model";
import { useDay, useDaySetup, useExpenses, useSalesData, useSalesSetup, useShiftData, useTankers, useTankersFromYesterday, useTankReadings } from "./queries";

/**
 * Everything saved for one day, through the engine: what Today and Review show. `model` is null
 * until every part has loaded.
 */
export function useWholeDay(pumpId: string, date: string | undefined) {
  const setup = useDaySetup(pumpId);
  const day = useDay(pumpId, date);
  const tanks = useTankReadings(day.data?.id);
  const shifts = useShiftData(day.data?.id);
  const tankers = useTankers(day.data?.id);
  const salesSetup = useSalesSetup(pumpId);
  const sales = useSalesData(day.data?.id);
  const expenses = useExpenses(day.data?.id);
  const fromYesterday = useTankersFromYesterday(pumpId, date);
  const parts = [setup, day, tanks, shifts, tankers, salesSetup, sales, expenses, fromYesterday];

  const model = useMemo(() => {
    if (!setup.data || !day.data || !tanks.data || !shifts.data || !tankers.data || !salesSetup.data || !sales.data || !expenses.data || !fromYesterday.data) return null;
    const bundle: SalesBundle = { setup: salesSetup.data, data: sales.data };
    const result = evaluate(
      setup.data,
      day.data,
      tankDays(setup.data, tanks.data.readings, tanks.data.yesterday),
      shiftInputs(setup.data, shifts.data, {}, bundle),
      tankerInputs(tankers.data),
      customerPaymentInputs(shifts.data.shifts, bundle),
      expenseInputs(setup.data, expenses.data),
      tankerInputs(fromYesterday.data),
    );
    const sections = todaySections(setup.data, day.data, tanks.data.readings, result, shifts.data, {}, tankers.data, bundle, expenses.data, fromYesterday.data);
    return { setup: setup.data, day: day.data, shifts: shifts.data, receipts: tankers.data, result, sections };
  }, [setup.data, day.data, tanks.data, shifts.data, tankers.data, salesSetup.data, sales.data, expenses.data, fromYesterday.data]);

  return {
    model,
    failed: parts.find((p) => p.error)?.error ?? null,
    loading: parts.some((p) => p.isPending),
    refetch: () => parts.forEach((p) => p.refetch()),
  };
}
