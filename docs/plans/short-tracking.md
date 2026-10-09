# Tracking a daily short (owner, 09 Oct 2026)

Status: **plan written 09 Oct 2026; owner picked D109 and D110; waiting for "go"** (can ship together with UI audit 1).

## Why
1 Oct: petrol sold as per tank 385.89 L vs meters 359.31 L = 26.58 L short (6.89%). Not a typo: the owner found nozzle problems. More fuel leaving the tank than the meters count points to a meter that under-counts, a leak, or fuel drawn without the meter. The owner needs to watch it every day and find which nozzle.

## D109. Daily trend (owner screen)
- **Dashboard › Fuel trend** (owner only; the Dashboard tab today is empty): the last 30 business days, newest first, one row per day per fuel: sold as per tank, sold as per meters, **Difference** (L, %, about ₹), coloured by the sign rule; a month total at the top ("Petrol: −142 L this month, about ₹15,630").
- Only submitted days count in the totals; unsubmitted days show "not submitted".
- Tap a day to open it (Review).
- Reads the database's `v_day_match` (the final truth, hard rule 4), so it matches what Review showed.

## D110. Nozzle test: what the measure got
- In **Testing**, each test row gets a second box: **"The 5 L measure got"** (litres in the can), next to "Meter showed" (today's "Litres tested").
- The app works out the nozzle's error: `measure − meter` and as % of the meter ("MS-3 gives 0.25 L more per 5 L: 5.0% more than the meter shows"). Positive = the nozzle gives more than it counts (a loss for the pump), shown red beyond the limit; negative = gives less (customer short), amber.
- Limit: IOCL's measure tolerance, ±25 mL per 5 L (0.5%) by default, a pump setting (`rules.testing.measureFlagBeyondPercent`).
- Optional: an empty measure box changes nothing (old days stay as they are).
- **Per-nozzle history:** Dashboard › Fuel trend lists each nozzle's latest checks (date, meter, measure, error) so a nozzle that's off every day stands out.
- Database: `nozzle_tests.measured_l` (new, empty) and a view `v_nozzle_checks`; migration 15. Engine: the error and the flag (S10 "nozzle measure off"), same maths in SQL, with a worked example.

## Not now
Litres per nozzle per day, and a daily note on a day (offered; the owner didn't pick them this time).
