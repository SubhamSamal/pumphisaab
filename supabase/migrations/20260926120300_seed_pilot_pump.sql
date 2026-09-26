-- ════════════════════════════════════════════════════════════════════════════
--  Migration 4 of 4 · 20260926120300_seed_pilot_pump
--
--  WHAT IT DOES
--    Loads Shree Lokanath Filling Station's setup, once:
--      • the pump (IOCL, Dhenkanal, day starts 06:00) and its rules (same as src/calc/rules.ts)
--      • the real 20 KL IOCL dip chart: 211 rows, 0 to 210 cm, full tank 21,628.93 L
--      • tanks MS-1 and HSD-1 (same chart); nozzles MS-1..4 and HSD-1..4 (1 and 2 not in use)
--      • shifts A 06-14, B 14-22, C 22-06 from 15 Sep 2026
--      • prices MS ₹110.07 and HSD ₹101.74 from 15 Sep 2026
--      • ways of getting paid, cash notes, expense types
--      • links the login subham@users.pumphisaab.com as the pump's Owner (username "subham").
--        Create that login FIRST in Authentication › Users. If it isn't there, everything else
--        still loads and you'll see a notice; link it later with the line at the bottom.
--    Credit customers and staff are not loaded; they're added in the app (decision D37).
--
--  DATA SAFETY:  ADDS NEW ROWS ONLY. No DROP · no ALTER · no TRUNCATE · no DELETE · no UPDATE.
--
--  HOW TO APPLY:  paste the whole file into Supabase › SQL editor › Run, after migration 3.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pump   uuid;
  v_chart  uuid;
  v_ms     uuid;
  v_hsd    uuid;
begin
  if not exists (select 1 from public.schema_migrations_applied where name = '20260926120200_calc_functions') then
    raise exception 'Apply migration 3 (20260926120200_calc_functions) first.';
  end if;
  if exists (select 1 from public.schema_migrations_applied where name = '20260926120300_seed_pilot_pump') then
    raise exception 'Migration 20260926120300_seed_pilot_pump was already applied. Nothing was changed.';
  end if;

  -- The pump and its rules ("when to flag"). Keep in step with src/calc/rules.ts (a test checks this).
  insert into public.pumps (name, omc, address, day_start_time, time_zone, rules)
  values ('Shree Lokanath Filling Station', 'IOCL', 'Dhenkanal, Odisha', '06:00', 'Asia/Kolkata',
    -- RULES-JSON-START
    '{
      "stockDifference": {
        "flagBeyondPercent": "0.5"
      },
      "shiftMoney": {
        "flagBeyondRupees": "100"
      },
      "bookStockGap": {
        "flagBeyondPercentOfDip": "0.5"
      },
      "nozzleSales": {
        "flagZeroSale": true,
        "spikeMultiple": "2",
        "historyDays": 7,
        "minHistoryDays": 3
      },
      "tanker": {
        "shortFlagBeyondPercent": "0.3",
        "dipCheckFlagBeyondPercent": "0.5"
      },
      "openingDip": {
        "flagBeyondCm": "0.5"
      },
      "expenseDailyCaps": {},
      "compliance": {
        "basePercent": "4",
        "evaporationPercent": {
          "HSD": "0.20",
          "MS": "0.75"
        }
      },
      "creditSlip": {
        "litreDecimals": 2,
        "litreRounding": "up"
      },
      "testing": {
        "defaultLitres": "5"
      }
    }'::jsonb
    -- RULES-JSON-END
  )
  returning id into v_pump;

  -- The real dip chart (docs/data/DipChart_20KL_MS1_HSD1.xlsx). A test checks every row.
  insert into public.dip_charts (pump_id, name, chart_version, source)
  values (v_pump, '20 KL horizontal IOCL', 1, 'DipChart_20KL_MS1_HSD1.xlsx')
  returning id into v_chart;

  insert into public.dip_chart_rows (pump_id, chart_id, dip_cm, volume_l)
  select v_pump, v_chart, r.dip_cm, r.volume_l
  from (values
      -- CHART-ROWS-START
      (0, 0),
      (1, 11.97),
      (2, 33.89),
      (3, 62.22),
      (4, 95.71),
      (5, 133.61),
      (6, 175.43),
      (7, 220.8),
      (8, 269.41),
      (9, 321.05),
      (10, 375.51),
      (11, 432.63),
      (12, 492.26),
      (13, 554.27),
      (14, 618.56),
      (15, 685.03),
      (16, 753.57),
      (17, 824.11),
      (18, 896.57),
      (19, 970.88),
      (20, 1046.97),
      (21, 1124.79),
      (22, 1204.28),
      (23, 1285.38),
      (24, 1368.04),
      (25, 1452.22),
      (26, 1537.87),
      (27, 1624.95),
      (28, 1713.41),
      (29, 1803.22),
      (30, 1894.35),
      (31, 1986.75),
      (32, 2080.39),
      (33, 2175.24),
      (34, 2271.27),
      (35, 2368.44),
      (36, 2466.74),
      (37, 2566.12),
      (38, 2666.57),
      (39, 2768.05),
      (40, 2870.54),
      (41, 2974.02),
      (42, 3078.46),
      (43, 3183.83),
      (44, 3290.12),
      (45, 3397.31),
      (46, 3505.36),
      (47, 3614.26),
      (48, 3723.99),
      (49, 3834.53),
      (50, 3945.86),
      (51, 4057.96),
      (52, 4170.8),
      (53, 4284.38),
      (54, 4398.67),
      (55, 4513.65),
      (56, 4629.31),
      (57, 4745.63),
      (58, 4862.59),
      (59, 4980.18),
      (60, 5098.38),
      (61, 5217.17),
      (62, 5336.53),
      (63, 5456.46),
      (64, 5576.94),
      (65, 5697.94),
      (66, 5819.46),
      (67, 5941.48),
      (68, 6063.98),
      (69, 6186.96),
      (70, 6310.39),
      (71, 6434.26),
      (72, 6558.56),
      (73, 6683.28),
      (74, 6808.39),
      (75, 6933.89),
      (76, 7059.77),
      (77, 7186),
      (78, 7312.58),
      (79, 7439.49),
      (80, 7566.72),
      (81, 7694.26),
      (82, 7822.09),
      (83, 7950.2),
      (84, 8078.58),
      (85, 8207.21),
      (86, 8336.09),
      (87, 8465.2),
      (88, 8594.52),
      (89, 8724.05),
      (90, 8853.77),
      (91, 8983.68),
      (92, 9113.75),
      (93, 9243.97),
      (94, 9374.34),
      (95, 9504.85),
      (96, 9635.47),
      (97, 9766.2),
      (98, 9897.02),
      (99, 10027.93),
      (100, 10158.91),
      (101, 10289.95),
      (102, 10421.04),
      (103, 10552.16),
      (104, 10683.31),
      (105, 10814.47),
      (106, 10945.62),
      (107, 11076.77),
      (108, 11207.89),
      (109, 11338.98),
      (110, 11470.02),
      (111, 11601),
      (112, 11731.91),
      (113, 11862.73),
      (114, 11993.46),
      (115, 12124.08),
      (116, 12254.59),
      (117, 12384.96),
      (118, 12515.18),
      (119, 12645.26),
      (120, 12775.16),
      (121, 12904.88),
      (122, 13034.41),
      (123, 13163.73),
      (124, 13292.84),
      (125, 13421.72),
      (126, 13550.35),
      (127, 13678.73),
      (128, 13806.84),
      (129, 13934.67),
      (130, 14062.21),
      (131, 14189.44),
      (132, 14316.35),
      (133, 14442.93),
      (134, 14569.16),
      (135, 14695.04),
      (136, 14820.54),
      (137, 14945.65),
      (138, 15070.37),
      (139, 15194.67),
      (140, 15318.54),
      (141, 15441.97),
      (142, 15564.95),
      (143, 15687.45),
      (144, 15809.47),
      (145, 15930.99),
      (146, 16051.99),
      (147, 16172.47),
      (148, 16292.4),
      (149, 16411.76),
      (150, 16530.55),
      (151, 16648.75),
      (152, 16766.34),
      (153, 16883.3),
      (154, 16999.62),
      (155, 17115.28),
      (156, 17230.26),
      (157, 17344.55),
      (158, 17458.13),
      (159, 17570.97),
      (160, 17683.07),
      (161, 17794.4),
      (162, 17904.94),
      (163, 18014.67),
      (164, 18123.57),
      (165, 18231.62),
      (166, 18338.81),
      (167, 18445.1),
      (168, 18550.47),
      (169, 18654.91),
      (170, 18758.39),
      (171, 18860.88),
      (172, 18962.36),
      (173, 19062.81),
      (174, 19162.19),
      (175, 19260.49),
      (176, 19357.66),
      (177, 19453.69),
      (178, 19548.54),
      (179, 19642.18),
      (180, 19734.58),
      (181, 19825.71),
      (182, 19915.52),
      (183, 20003.98),
      (184, 20091.06),
      (185, 20176.71),
      (186, 20260.89),
      (187, 20343.55),
      (188, 20424.65),
      (189, 20504.14),
      (190, 20581.96),
      (191, 20658.05),
      (192, 20732.36),
      (193, 20804.82),
      (194, 20875.36),
      (195, 20943.91),
      (196, 21010.37),
      (197, 21074.66),
      (198, 21136.67),
      (199, 21196.3),
      (200, 21253.42),
      (201, 21307.88),
      (202, 21359.52),
      (203, 21408.13),
      (204, 21453.5),
      (205, 21495.32),
      (206, 21533.22),
      (207, 21566.71),
      (208, 21595.04),
      (209, 21616.96),
      (210, 21628.93)
      -- CHART-ROWS-END
  ) as r(dip_cm, volume_l);

  -- Tanks: both use the same chart; capacity is set from the chart's last row.
  insert into public.tanks (pump_id, label, product, chart_id) values (v_pump, 'MS-1', 'MS', v_chart) returning id into v_ms;
  insert into public.tanks (pump_id, label, product, chart_id) values (v_pump, 'HSD-1', 'HSD', v_chart) returning id into v_hsd;

  -- Nozzles: 1 and 2 are not in use on either fuel (decision D30).
  insert into public.nozzles (pump_id, label, product, tank_id, in_use, sort_order) values
    (v_pump, 'MS-1',  'MS',  v_ms,  false, 1),
    (v_pump, 'MS-2',  'MS',  v_ms,  false, 2),
    (v_pump, 'MS-3',  'MS',  v_ms,  true,  3),
    (v_pump, 'MS-4',  'MS',  v_ms,  true,  4),
    (v_pump, 'HSD-1', 'HSD', v_hsd, false, 5),
    (v_pump, 'HSD-2', 'HSD', v_hsd, false, 6),
    (v_pump, 'HSD-3', 'HSD', v_hsd, true,  7),
    (v_pump, 'HSD-4', 'HSD', v_hsd, true,  8);

  -- Shift timings.
  insert into public.shift_templates (pump_id, starts_on, shifts) values (v_pump, '2026-09-15',
    '[{"code": "A", "name": "Shift A", "start": "06:00", "end": "14:00"},
      {"code": "B", "name": "Shift B", "start": "14:00", "end": "22:00"},
      {"code": "C", "name": "Shift C", "start": "22:00", "end": "06:00"}]'::jsonb);

  -- Prices on 15 Sep 2026 (from the notebook). Confirm or change on the first real day.
  insert into public.fuel_prices (pump_id, product, per_litre, starts_on) values
    (v_pump, 'MS',  110.07, '2026-09-15'),
    (v_pump, 'HSD', 101.74, '2026-09-15');

  -- Ways of getting paid (decision D25).
  insert into public.payment_types (pump_id, name, kind, sort_order) values
    (v_pump, 'Cash',          'CASH',   1),
    (v_pump, 'Paytm',         'OTHER',  2),
    (v_pump, 'Card',          'OTHER',  3),
    (v_pump, 'XtraPower',     'OTHER',  4),
    (v_pump, 'Bank transfer', 'OTHER',  5),
    (v_pump, 'Credit',        'CREDIT', 6);

  -- Notes for the cash count; coins are typed as one amount.
  insert into public.cash_denominations (pump_id, value, sort_order) values
    (v_pump, 500, 1), (v_pump, 200, 2), (v_pump, 100, 3), (v_pump, 50, 4), (v_pump, 20, 5), (v_pump, 10, 6);

  -- Expense types (decision D33).
  insert into public.expense_categories (pump_id, name, default_type, sort_order) values
    (v_pump, 'Salary',                          'FIXED',    1),
    (v_pump, 'Staff advance',                   'VARIABLE', 2),
    (v_pump, 'Tiffin',                          'VARIABLE', 3),
    (v_pump, 'Staff food',                      'VARIABLE', 4),
    (v_pump, 'Bakshis',                         'VARIABLE', 5),
    (v_pump, 'DG rent',                         'FIXED',    6),
    (v_pump, 'Tanker unloading',                'VARIABLE', 7),
    (v_pump, 'Tanker driver food',              'VARIABLE', 8),
    (v_pump, 'Cash advance to credit customer', 'VARIABLE', 9),
    (v_pump, 'Other',                           'VARIABLE', 10);

  -- The owner's login (create it first in Authentication › Users).
  perform private.link_member(v_pump, 'subham@users.pumphisaab.com', 'subham', 'Subham Samal', 'OWNER');
end $$;

insert into public.schema_migrations_applied (name) values ('20260926120300_seed_pilot_pump');

-- If you saw the notice "No login found", create the login, then run this one line on its own:
--   select private.link_member((select id from public.pumps where name = 'Shree Lokanath Filling Station'),
--          'subham@users.pumphisaab.com', 'subham', 'Subham Samal', 'OWNER');
