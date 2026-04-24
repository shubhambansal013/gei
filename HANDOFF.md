# Session Handoff — 2026-04-24

Pick-up notes for the next person (hi Shubham) touching `feature/foundation`.

## State

- Branch: `feature/foundation` — **39 commits ahead** of `main`, origin in sync.
- Tip: `94ce7f4 fix(security): block non-admin profile self-promotion (#22)`.
- Gates: `pnpm typecheck` clean · `pnpm lint` 0/0 · `pnpm test --run` 108/108 green.
- RLS tests (`pnpm test:rls`) need `supabase start` — not executed in this session.

## What shipped this session (22 issues touched)

**Closed (code-complete, tests green on this branch):** #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #12, #13, #14, #15, #16, #17 (partial — heuristic), #18, #19, #20, #22.

**Intent-honoured, library swap rejected:** #11 (added elevation + motion tokens instead of a Material rewrite).

See git log for detailed rationale. Wave structure:

| Scope            | Issues        | Key commits                                                      |
| ---------------- | ------------- | ---------------------------------------------------------------- |
| Security         | #1 #2 #12 #22 | `169f49c`, `38d65a1`, `e04d966`, `8773ed4`, `a5aee61`, `94ce7f4` |
| Rename           | #3 #5 #10     | `ebcdb61`, `10880c7`, `6a3dbcd`, `c79b062`, `7afc5ca`            |
| Items units      | #18           | `fc8acbf`, `facbede`, `ee30263`, `ae7c0b5`                       |
| Workforce        | #15 #16 #19   | `5896aa0`, `7f8ad8d`, `2c6b3b4`, `7409fa4`, `20f4cf1`            |
| Mobile + reports | #8 #17 #20    | `87f91cc`, `38246ea`, `a2352bf`                                  |
| Tooling          | #9 #13 #14    | `6df9a66`, `1967571`, `07e74a2`, `c804356`, `6bd44c7`, `08988f2` |
| Entry UX         | #4 #6 #7      | `a61d42f`, `1967d54`, `920a1a8`                                  |

## Still open on GitHub

- **#27** — Log sub-contractor for worker in issue. Snapshot the worker's current `worker_affiliations.contractor_party_id` onto the `issues` row at create time, so historical records survive a future affiliation change. Denormalise `issued_under_party_id UUID` on `issues` (nullable; stamped in `createIssue` server action by reading the worker's open affiliation row).
- **#28** — Conv factor belongs on the purchase, not (only) the item. Today `items.stock_conv_factor` is a single tenant-wide default; the stakeholder clarified conv factor varies by **supplier** (one ships 100 m rolls, another 300 m). `purchases.unit_conv_factor` already exists and is per-row — the fix is to (a) treat `items.stock_conv_factor` as just a default to pre-fill the purchase form, (b) expose the per-purchase conv factor field in `inward-form.tsx` so it's editable, (c) allow post-create edits via the existing edit-dialog (without soft-delete). See existing `purchases.received_unit` + `stock_unit` + `unit_conv_factor` columns — they already model this.
- **#11** — Material Design. Intent addressed via tokens; may still need stakeholder sign-off or a "close with explanation" comment.

## Code-complete but GitHub issue still marked OPEN

Need explicit `gh issue close` (commits don't carry `Fixes #N` trailers):

```
gh issue close 1 2 4 6 7 12 14 17 18 20 --comment "Landed on feature/foundation"
```

(Issues 3, 5, 8, 9, 10, 13, 15, 16, 19 are already closed. #11 and #22 should be closed manually after review.)

## Known deliberate deferrals

- **Dashboard avg-cost (#17)** — 90-day running WAC heuristic with `TODO(#17)` markers in `dashboard/page.tsx` and `reports/items/items-report-client.tsx`. Replace once the FIFO / WAC / moving-avg decision is made.
- **Single-open-site-assignment invariant (Wave 3 #15)** — enforced in `app/(app)/masters/workers/actions.ts` only, not at the DB. A partial unique index `(worker_id) WHERE effective_to IS NULL` would tighten this but would block bulk-import from reconstructing historical data.
- **Affiliation back-dating** — the UI intentionally refuses `effective_from` inside an existing closed range. A "correct a mistake" reopen flow is a future feature.
- **RLS tests skipped without Supabase local** — `tests/rls/workers.test.ts`, `tests/rls/units-admin-write.test.ts`, `tests/rls/role-permissions-super-admin-write.test.ts`, `tests/rls/profile-privilege-escalation.test.ts`. Run `supabase start && pnpm test:rls` to execute.
- **Units audit trail** — hook-point is shaped in `app/(app)/masters/units/actions.ts` but not wired (no edit-reason trigger on the table yet).

## Key decisions (so you don't re-litigate)

- **URL routes are preserved** — `/inventory/inward/new` and `/inventory/outward/new` stay as-is for bookmark / muscle-memory continuity. Only UI labels, component names, types, and DB module ids were renamed.
- **File names `inward-form.tsx` / `outward-form.tsx`** — kept as-is for merge safety; rename later if desired.
- **`DESIGN.md` + globals.css tokens** are the shared design system. Don't add MUI / Radix / anything non-shadcn without a spec amendment.
- **Spec + plan files in `docs/superpowers/*`** are immutable per CLAUDE.md §2 — amend via new dated files.
- **Base migration `20260420000001_base_schema.sql`** is history; the rename migration `20260423000003_rename_modules.sql` supersedes it.

## Recommended next

1. **Close #22 + #11** on GitHub with a short comment (security + design-intent reasoning).
2. **Fix #27** — migration adds `issued_under_party_id` to `issues`; stamped from worker's current affiliation in `createIssue`. One commit.
3. **Fix #28** — expose `unit_conv_factor` field in the purchase form (pre-filled from `items.stock_conv_factor`), and make purchases editable via the existing edit-dialog. Dependent: #18's canonical stock_unit already landed, so the pre-fill source is in place.
4. **Wire Workers edge-cases** — `/masters/workers` detail drawer with affiliation + assignment history timeline (Wave 3 deferred this).
5. **Bulk-close resolved GitHub issues** (`gh issue close …`).

## File map for the two new pickers

- `components/worker-picker.tsx` — WorkerPicker with inline "+ New worker (DIRECT)" quick-create. Used in outward form.
- `components/party-picker.tsx` — PartyPicker with inline "+ New party" quick-create. Takes optional `type` prop to pre-select SUPPLIER / CONTRACTOR / etc. Used in inward + outward forms.

Both follow the same sentinel-option pattern (`__NEW__` row at the bottom of the list → opens a Dialog).
