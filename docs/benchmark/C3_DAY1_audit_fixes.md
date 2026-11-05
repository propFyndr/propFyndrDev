# 5 Nov 2026: fixes from the task audit (approach A)

All on the `dev` branch, tested against the dev database (endpoint `ep-odd-bar-az91o2md`). Nothing is on live until Furqan says yes to a push.

## 1. No invented figure on the property page (tracker A1, F1)

Before: a project missing data still showed typical figures.

| Where | Was | Now |
|---|---|---|
| Pricing tab, cost breakdown | Club ₹2,00,000, IFMS ₹75,000, utilities ₹1,25,000, other ₹1,25,000, PLC 2% of price when not on record (tagged "estimated") | Only charges on record. The total says "charges on record" and names the missing ones: "Not on record for this project: PLC, club membership, IFMS, other charges. The total excludes them; ask the builder for the cost sheet." |
| Pricing tab, breakdown with no unit price | Built on the slider's ₹1 Cr starting value | Not shown |
| Pricing tab, GST | 5% default, tagged "estimated" | Statutory: stored rate, else 0% only with `oc_status = FULL_OC`, else 5% |
| Pricing tab, payment plans | Four template schedules ("Sanction from ICICI/HDFC/SBI", slab stages) for any project without a plan | Only stored plans; otherwise "This payment plan is not on record for this project. Ask the builder for the booking sheet." The comparison modal lists only stored plans |
| Pricing tab, possession | "Delivered & Ready" for every ready-to-move project | "Ready to move" (a status, not a delivery or OC claim) |
| Cost sheet section, GST | 0% "OC Received / Ready" for every ready-to-move project | 0% only with an OC on record; ready-to-move without one says "OC not on record: 5% GST Applicable" |
| Builder tab | Founded 2012, "12+ years", "3+ projects delivered", "3.5M+ sq ft" (or units × 1,450 sq ft), "one of India's most trusted brands", "Timely Delivery: track record of on-time completion" for every builder | Only stored figures; "Founding year not on record", "No delivery figures on record"; the generic praise and the "Why choose" grid are removed |
| Charts | "₹0.00 Cr" when no price | "Price on request" |
| Intelligence tab | A unit with no BHK counted as 2 BHK | Skipped |
| Location tab | Unused fallback pin at 28.535, 77.391 | Removed (dead code) |

**Tests (fail on the old code, pass now):**
- `frontend/__tests__/noInventedFigures.test.tsx`: old BuilderTab 2 failed / 2; new 2/2.
- `frontend/__tests__/pricingTabNoInventedCharges.test.tsx`: old ProjectPricingTab 2 failed / 3; old CostSheetSection 1 failed / 3; new 3/3.

## 2. Invented figures written into the database by admin (new finding)

- `PUT /admin/projects/:id/cost-sheet` computed and **stored** an all-inclusive price from defaults when a field was blank (₹6,500/sq ft, ₹3.5 L parking, ₹1.5 L club, a 1,350 sq ft flat). Removed: the row stores what the admin entered.
- `POST /admin/projects/:id/units` defaulted BHK to 2, built-up area to carpet × 1.15 and orientation to east/north facing. Now BHK is required (400), and the other two are left empty when not given.
- **Existing rows (read-only query, 5 Nov):** both live and dev have 382 cost sheets, 206 of them with `all_inclusive_price_cr`. The chat cost table prints it as "All-inclusive Total" (`marketTable.ts:638`). We cannot tell which of the 206 came from this admin path and which from the seed scripts; several seed scripts also write cost sheets. No row was changed. This needs the same owner decision as the seed prices.

## 3. Price history is append-only (tracker C6, F3)

`PUT /admin/projects/:id/price-history` deleted every row for the project and re-created the list sent, with a "Q1 2025" default quarter. Now (`lib/priceHistoryAppend.ts`):
- saved rows are never changed or deleted;
- only new points are appended;
- a new point needs a quarter and a price.

The admin editor no longer pre-fills "Q1 2025 / ₹7,200". It locks saved points and reloads the list after a save, so a point is never appended twice. Test: `backend/src/lib/__tests__/priceHistoryAppend.test.ts` 3/3, including a check that the route contains no delete or update.

## 4. Answers when every provider fails (tracker C3)

Correction to the audit: the cost sheet was already covered. `costSheet.ts` puts the code-built table on screen before the model, and `outageReplay.test.ts` has an `outage-cost-sheet` case. All five types pass on dev (`outageReplay.test.ts`: pass, 5 Nov).

The remaining gap: a project with **no** cost sheet got the outage notice. It now gets "Cost sheet: not on record for X. The builder's charges are in its booking cost sheet…" (`costSheetNotOnRecord`). Test: `backend/src/lib/chat/__tests__/rowsAnswer.test.ts` 4/4. This is the first unit test of `rowsAnswer.ts`, and it covers the full no-model path through `executeWithFallbackChain`.

## 5. Stall proof at the production setting (tracker B1, C2)

`backend/src/lib/ai/__tests__/fallbackStallProof.test.ts` keeps the default `FALLBACK_HEDGE_MS` (5 s). The setup:
- the primary accepts the request and never speaks;
- the backup takes 2 s to its first word.

Result (5 Nov, laptop):
- first word at **7.06 s**, done at **7.06 s**;
- the primary was aborted.

Both are inside the plan's targets (start ≤ 8 s, finish ≤ 20 s). The margin is under 1 s: a backup slower than 3 s to its first word misses the 8 s target. The fake server is local, so this proves the chain logic, not Render's network.

## 6. 60-question comparison (tracker B3, C1 of cycle 0)

`docs/benchmark/scorecards/CORPUS60_COMPARE_2026-11-05.md` compares question by question:
- 42/60 on 26 Oct;
- 58/60 and 60/60 on 31 Oct;
- 18 fixed, 0 regressed.

All three runs were local against the dev database. **None was run against the live site**, so "60 questions on the live AI" stays open. The raw answers are committed beside it.

## Checks

- `npx tsc --noEmit` passes for frontend and backend; eslint shows no errors on touched files (only existing `exhaustive-deps` warnings).
- Frontend `npx jest`: 51 suites, 363 tests, all pass.
- Backend `npm test` (5 Nov, this laptop): 4,992 tests, 4,206 pass, 6 fail, the rest skipped (live-only). None of the 6 is caused by these changes:
  - `chatRouterSize.test.ts`: `chat-router.ts` is 7,577 lines against a limit of 7,387, and the POST handler is 6,791 against 6,637. It fails at HEAD too (the 4 Nov latency commit grew the file); this work does not touch `chat-router.ts`.
  - `fallbackRace.test.ts`, `searchSummary.test.ts`, `paragraphStreaming.test.ts`: each passes when run alone. Under the runner's `node --require tsx/cjs` on this laptop's **Node 26** (the project pins 22 in `.nvmrc`), their dynamic `await import('../x')` fails with ERR_MODULE_NOT_FOUND. None of the modules they import was changed. The new stall proof uses a static import for this reason.
- The new tests, run the same way as the runner: `fallbackStallProof`, `rowsAnswer` and `priceHistoryAppend`, 8/8. The stall proof re-run put the first word at 7.17 s.
- `outageReplay.test.ts` on dev: pass.
