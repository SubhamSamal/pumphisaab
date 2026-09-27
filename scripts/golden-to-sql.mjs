// Turns the golden cases into a database test, so the database gives exactly the app's answers
// (CLAUDE.md hard rule 4).   Run: npm run golden:sql
// Writes supabase/tests/03_golden.test.sql. A Vitest test fails if that file is out of date.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const OUT = "supabase/tests/03_golden.test.sql";

export function buildGoldenSql() {
  const casesDir = "tests/golden/cases";
  const charts = { "iocl-20kl": JSON.parse(readFileSync("tests/golden/charts/iocl-20kl.json", "utf8")).rows };
  const cases = readdirSync(casesDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(`${casesDir}/${f}`, "utf8")) }));

  const sqlText = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const decimals = (s) => (s.includes(".") ? s.length - s.indexOf(".") - 1 : 0);
  const tests = [];
  const setup = [];
  const dayCases = [];
  // Test chart for the PRD examples (same as tests/golden/golden.test.ts): 1 cm = 100 L, up to 300 cm.
  charts["linear-100"] = Array.from({ length: 301 }, (_, cm) => [String(cm), String(cm * 100)]);

  for (const c of cases) {
    if (c.kind === "dip") {
      const rows = charts[c.chart].map(([d, l]) => `(${d}, ${l})`).join(",\n    ");
      setup.push(`-- Chart for ${c.file}
insert into public.dip_charts (id, pump_id, name, chart_version)
  select 'dddddddd-0000-0000-0000-000000000001', id, 'golden ${c.chart}', 99 from public.pumps limit 1;
insert into public.dip_chart_rows (pump_id, chart_id, dip_cm, volume_l)
  select (select id from public.pumps limit 1), 'dddddddd-0000-0000-0000-000000000001', d, l from (values
    ${rows}) v(d, l);`);
      for (const r of c.readings) {
        const got = `public.dip_to_litres('dddddddd-0000-0000-0000-000000000001', ${r.dipCm})`;
        tests.push(
          r.litres === null
            ? `select is(${got}, null, ${sqlText(`${c.file}: ${r.dipCm} cm is outside the chart`)});`
            : `select is(round(${got}, ${decimals(r.litres)}), ${r.litres}::numeric, ${sqlText(`${c.file}: ${r.dipCm} cm = ${r.litres} L`)});`,
        );
      }
    }
    if (c.kind === "price") {
      setup.push(`-- Prices for ${c.file}
insert into public.pumps (id, name, rules) values ('eeeeeeee-0000-0000-0000-000000000001', 'golden prices', '{}');
insert into public.fuel_prices (pump_id, product, per_litre, starts_on) values
  ${c.prices.map((p) => `('eeeeeeee-0000-0000-0000-000000000001', '${p.product}', ${p.perLitre}, '${p.startsOn}')`).join(",\n  ")};`);
      for (const l of c.lookups) {
        const got = `public.price_for('eeeeeeee-0000-0000-0000-000000000001', '${l.product}', '${l.date}')`;
        tests.push(`select is(${got}, ${l.perLitre === null ? "null" : `${l.perLitre}::numeric`}, ${sqlText(`${c.file}: ${l.product} on ${l.date}`)});`);
      }
    }
    if (c.kind === "day") {
      dayCases.push(c);
    }
    // A single tanker: run it as a day with just that tanker on the real chart (slice 4c).
    if (c.kind === "tanker") {
      dayCases.push({
        ...c,
        input: {
          businessDate: "2026-10-01",
          tanks: c.receipt.lines.map((l) => ({ id: l.tankId, label: l.tankId, product: l.product, chart: "iocl-20kl" })),
          tankDays: [],
          shifts: [],
          tankers: [c.receipt],
        },
        expected: { tankers: { [c.receipt.id]: c.expected } },
      });
    }
    if (c.kind === "businessDate") {
      for (const b of c.cases) {
        tests.push(
          `select is(public.business_date_at('${b.at}'::timestamptz, '${b.dayStart}', 'Asia/Kolkata'), '${b.businessDate}'::date, ${sqlText(`${c.file}: ${b.at}, day starts ${b.dayStart}`)});`,
        );
      }
    }
  }

  // ─── Whole days: loaded into real tables, one made-up pump per case ───────
  // Each Phase 4 slice checks more of the day through the SQL views. Today (4a): the dips
  // (H3 refused on save) and the opening-dip flags S3 and S7 from v_tank_day.
  if (dayCases.length) {
    setup.push(`-- Charts used by the day cases
create temp table golden_chart_rows (chart text, dip_cm numeric, volume_l numeric) on commit drop;
insert into golden_chart_rows values
  ${Object.entries(charts)
    .flatMap(([name, rows]) => rows.map(([d, l]) => `('${name}', ${d}, ${l})`))
    .join(",\n  ")};`);
  }
  const PILOT_RULES = "(select rules from public.pumps where name = 'Shree Lokanath Filling Station')";
  const chartMax = (name) => Math.max(...charts[name].map(([d]) => Number(d)));
  dayCases.forEach((c, i) => {
    const n = String(i + 1).padStart(4, "0");
    const pump = `'a0000000-0000-0000-0000-00000000${n}'`;
    const day = `'a1000000-0000-0000-0000-00000000${n}'`;
    const yesterday = `'a2000000-0000-0000-0000-00000000${n}'`;
    const input = c.input;
    const lines = [`-- ${c.file}: ${c.description.replace(/\n/g, " ")}`];
    lines.push(
      `insert into public.pumps (id, name, rules) values (${pump}, ${sqlText(`golden ${c.file}`)}, ${PILOT_RULES}${c.rules ? ` || ${sqlText(JSON.stringify(c.rules))}::jsonb` : ""});`,
    );
    const usedCharts = [...new Set(input.tanks.map((t) => t.chart))];
    for (const ch of usedCharts) {
      lines.push(`insert into public.dip_charts (pump_id, name) values (${pump}, '${ch}');
insert into public.dip_chart_rows (pump_id, chart_id, dip_cm, volume_l)
  select ${pump}, (select id from public.dip_charts where pump_id = ${pump} and name = '${ch}'), dip_cm, volume_l from golden_chart_rows where chart = '${ch}';`);
    }
    const tank = (id) => `(select id from public.tanks where pump_id = ${pump} and label = ${sqlText(input.tanks.find((t) => t.id === id).label)})`;
    for (const t of input.tanks) {
      lines.push(
        `insert into public.tanks (pump_id, label, product, chart_id) values (${pump}, ${sqlText(t.label)}, '${t.product}', (select id from public.dip_charts where pump_id = ${pump} and name = '${t.chart}'));`,
      );
    }
    lines.push(`insert into public.business_days (id, pump_id, business_date) values (${day}, ${pump}, '${input.businessDate}');`);

    // Yesterday, rebuilt from what the case says about it: its closing dip (S7) and its
    // IOCL gap (S3: opening dip 0 cm = 0 L, so the IOCL report stock is the gap itself).
    const allNozzles = input.shifts.flatMap((sh) => sh.nozzles);
    const needsYesterday =
      input.tankDays.some((td) => td.yesterdayClosingDipCm !== undefined || td.yesterdayBookGapLitres !== undefined) ||
      allNozzles.some((n) => n.previousClosing !== undefined);
    if (needsYesterday) {
      lines.push(`insert into public.business_days (id, pump_id, business_date) values (${yesterday}, ${pump}, '${input.businessDate}'::date - 1);`);
    }
    const reading = (dayId, td, type, cm, book) =>
      `insert into public.tank_readings (pump_id, day_id, tank_id, reading_type, dip_cm, book_stock_l) values (${pump}, ${dayId}, ${tank(td.tankId)}, '${type}', ${cm ?? "null"}, ${book ?? "null"})`;
    for (const td of input.tankDays) {
      const max = chartMax(input.tanks.find((t) => t.id === td.tankId).chart);
      if (td.yesterdayClosingDipCm !== undefined) lines.push(`${reading(yesterday, td, "CLOSING", td.yesterdayClosingDipCm)};`);
      if (td.yesterdayBookGapLitres !== undefined) {
        if (Number(td.yesterdayBookGapLitres) < 0) throw new Error(`${c.file}: a negative yesterday gap can't be rebuilt in the database`);
        lines.push(`${reading(yesterday, td, "OPENING", "0", td.yesterdayBookGapLitres)};`);
      }
      for (const [type, cm, book] of [
        ["OPENING", td.openingDipCm, td.bookStockLitres],
        ["CLOSING", td.closingDipCm, undefined],
      ]) {
        if (cm === undefined) continue;
        if (Number(cm) < 0 || Number(cm) > max) {
          tests.push(`select throws_ok(${sqlText(reading(day, td, type, cm, book))}, 'P0001', null, ${sqlText(`${c.file}: H3, ${cm} cm is refused (outside the chart)`)});`);
          continue;
        }
        lines.push(`${reading(day, td, type, cm, book)};`);
      }
    }
    // Nozzles, shifts, meter readings and testing (slice 4b).
    const nozzleIds = [...new Map(allNozzles.map((n) => [n.nozzleId, n])).values()];
    nozzleIds.forEach((nz, k) => {
      lines.push(
        `insert into public.nozzles (pump_id, label, product, tank_id, in_use, sort_order) values (${pump}, ${sqlText(nz.label)}, '${nz.product}', ${tank(nz.tankId)}, ${nz.inUse}, ${k});`,
      );
    });
    const nozzle = (id) => `(select id from public.nozzles where pump_id = ${pump} and label = ${sqlText(nozzleIds.find((n) => n.nozzleId === id).label)})`;
    const START = { A: "06:00", B: "14:00", C: "22:00" };
    const shiftRef = (dayId, code) => `(select id from public.shifts where day_id = ${dayId} and shift_code = '${code}')`;
    const addShift = (dayId, date, code) =>
      lines.push(
        `insert into public.shifts (pump_id, day_id, shift_code, starts_at, ends_at) values (${pump}, ${dayId}, '${code}', (${date} + time '${START[code]}') at time zone 'Asia/Kolkata', (${date} + time '${START[code]}') at time zone 'Asia/Kolkata' + interval '8 hours');`,
      );
    // Last night's closings (H2 compares today's opening with them): yesterday's Shift C.
    const withPrevious = allNozzles.filter((n) => n.previousClosing !== undefined);
    if (withPrevious.length) {
      addShift(yesterday, `'${input.businessDate}'::date - 1`, "C");
      for (const n of withPrevious) {
        lines.push(
          `insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, closing) values (${pump}, ${yesterday}, ${shiftRef(yesterday, "C")}, ${nozzle(n.nozzleId)}, ${n.previousClosing});`,
        );
      }
    }
    for (const sh of input.shifts) {
      addShift(day, `'${input.businessDate}'::date`, sh.code);
      for (const n of sh.nozzles) {
        if (n.opening === undefined && n.closing === undefined) continue;
        const insert = `insert into public.nozzle_readings (pump_id, day_id, shift_id, nozzle_id, opening, opening_typed, closing) values (${pump}, ${day}, ${shiftRef(day, sh.code)}, ${nozzle(n.nozzleId)}, ${n.opening ?? "null"}, ${n.opening !== undefined}, ${n.closing ?? "null"})`;
        if (n.opening !== undefined && n.closing !== undefined && Number(n.closing) < Number(n.opening)) {
          tests.push(`select throws_ok(${sqlText(insert)}, '23514', null, ${sqlText(`${c.file}: H1, ${n.label} closing below opening is refused`)});`);
          continue;
        }
        lines.push(`${insert};`);
        if (n.meterChangeApproved) {
          lines.push(
            `update public.nozzle_readings set meter_change_status = 'APPROVED' where shift_id = ${shiftRef(day, sh.code)} and nozzle_id = ${nozzle(n.nozzleId)};`,
          );
        }
      }
      for (const t of sh.tests) {
        lines.push(
          `insert into public.nozzle_tests (pump_id, day_id, shift_id, nozzle_id, litres) values (${pump}, ${day}, ${shiftRef(day, sh.code)}, ${nozzle(t.nozzleId)}, ${t.litres});`,
        );
      }
    }

    // Tankers (slice 4c). Tanker numbers are saved in capitals without spaces.
    for (const t of input.tankers) {
      const vehicle = t.vehicleNo.toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(4, "0").slice(0, 12);
      const receipt = `(select id from public.tanker_receipts where day_id = ${day} and invoice_no = ${sqlText(`golden ${t.id}`)})`;
      lines.push(`insert into public.tanker_receipts (pump_id, day_id, vehicle_no, invoice_no) values (${pump}, ${day}, '${vehicle}', ${sqlText(`golden ${t.id}`)});`);
      for (const l of t.lines) {
        lines.push(
          `insert into public.receipt_lines (pump_id, day_id, receipt_id, product, tank_id, ordered_l, short_l, price_per_l, margin_per_l, dip_before_cm, dip_after_cm) values (${pump}, ${day}, ${receipt}, '${l.product}', ${tank(l.tankId)}, ${l.orderedLitres}, ${l.shortLitres ?? 0}, ${l.pricePerLitre ?? "null"}, ${l.marginPerLitre ?? "null"}, ${l.dipBeforeCm ?? "null"}, ${l.dipAfterCm ?? "null"});`,
        );
      }
      // Expected per-tanker numbers, through v_receipt_lines (first line) and v_tanker_totals.
      const want = c.expected.tankers?.[t.id];
      if (want) {
        const lineCols = { receivedNetLitres: "received_l", dipRiseLitres: "dip_rise_l", amount: "amount", shortAmount: "short_amount", margin: "margin" };
        const totalCols = { totalAmount: "total_amount", totalShortAmount: "total_short_amount", toPay: "to_pay", totalMargin: "total_margin" };
        for (const [key, value] of Object.entries(want)) {
          const col = lineCols[key] ?? totalCols[key];
          if (!col) continue;
          const from = lineCols[key]
            ? `public.v_receipt_lines where receipt_id = ${receipt} and product = '${t.lines[0].product}'`
            : `public.v_tanker_totals where receipt_id = ${receipt}`;
          tests.push(`select is((select round(${col}, ${decimals(value)}) from ${from}), ${value}::numeric, ${sqlText(`${c.file}: tanker ${t.id} ${key} = ${value}`)});`);
        }
      }
    }

    setup.push(lines.join("\n"));

    // Tanker flags (S6) through v_receipt_lines, compared with the case's S6 flags.
    if (c.expected.flags) {
      const want = c.expected.flags.filter((f) => f === "S6").length;
      tests.push(
        `select is((select coalesce(sum(s6_short::int + s6_dip::int), 0)::int from public.v_receipt_lines where day_id = ${day}), ${want}, ${sqlText(`${c.file}: tanker flags (S6) = ${want}`)});`,
      );
    }

    // Litres per fuel for the day, through v_shift_litres (only what the case states).
    for (const [fuel, want] of Object.entries(c.expected.products ?? {})) {
      const sql = {
        meterLitres: "sum(meter_litres)",
        testLitres: "sum(test_litres)",
        soldAsPerMeters: "sum(meter_litres - test_litres)",
      };
      for (const [key, expr] of Object.entries(sql)) {
        if (want[key] === undefined) continue;
        tests.push(
          `select is((select round(${expr}, ${decimals(want[key])}) from public.v_shift_litres where day_id = ${day} and product = '${fuel}'), ${want[key]}::numeric, ${sqlText(`${c.file}: ${fuel} ${key} = ${want[key]}`)});`,
        );
      }
    }

    // What blocks the day that the database can see so far (H2, H8) through day_problems().
    if (c.expected.hardErrors) {
      const want = c.expected.hardErrors.filter((h) => h === "H2" || h === "H8").sort();
      tests.push(
        `select is((select coalesce(array_agg(code order by code), '{}') from public.day_problems(${day})), array[${want.map((h) => `'${h}'`).join(", ")}]::text[], ${sqlText(`${c.file}: meter problems (H2, H8) are ${want.join(", ") || "none"}`)});`,
      );
    }

    if (c.expected.flags) {
      const want = c.expected.flags.filter((f) => f === "S3" || f === "S7").sort();
      tests.push(
        `select is((select coalesce(array_agg(code order by code), '{}') from (select 'S3' as code from public.v_tank_day where pump_id = ${pump} and day_id = ${day} and s3_flag union all select 'S7' from public.v_tank_day where pump_id = ${pump} and day_id = ${day} and s7_flag) f), array[${want.map((f) => `'${f}'`).join(", ")}]::text[], ${sqlText(`${c.file}: opening-dip flags (S3, S7) are ${want.join(", ") || "none"}`)});`,
      );
    }
  });

  return `-- GENERATED by scripts/golden-to-sql.mjs from tests/golden/cases. Don't edit by hand: run npm run golden:sql.
-- The database's maths must give exactly the same answers as the app's (CLAUDE.md hard rule 4).
begin;
create extension if not exists pgtap with schema extensions;
select plan(${tests.length});

${setup.join("\n\n")}

${tests.join("\n")}

select * from finish();
rollback;
`;
}

if (process.argv[1] && process.argv[1].endsWith("golden-to-sql.mjs")) {
  writeFileSync(OUT, buildGoldenSql());
  console.log(`Wrote ${OUT}`);
}
