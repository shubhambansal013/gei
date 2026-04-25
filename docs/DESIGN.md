# GEI — Design System

**Direction:** Industrial-minimal. The product is a tool a site-store
worker stares at for six hours a day. Visual noise is their tax. The
Excel-familiar VIEW stays brutal (1px gray gridlines, monospace,
tabular-nums). The chrome around it is quiet, warm, and confident.

Tokens live in `app/globals.css`. This document explains what they
mean and how to use them. When a new screen drifts from this system,
fix the screen, not the doc.

---

## 1. Color

All colors are declared in OKLCH so they interpolate cleanly and
survive theme inversions.

### Primary — construction amber

```css
--primary: oklch(0.54 0.166 36); /* ≈ #C2410C */
--primary-foreground: oklch(0.99 0.005 80);
```

Used for:

- **Brand lockup** — `GEI` wordmark on login, top bar, emails.
- **Primary CTAs** — `<Button>` default variant.
- **Active nav state** — currently-selected sidebar link.
- **Focus rings** — `--ring` reuses the primary so keyboard focus
  matches the brand.

Do NOT use amber for:

- Decorative flourishes (no gradients, no tinted backgrounds).
- Success / info states (use semantic tokens).
- Link text in body copy (use `--foreground`).

### Neutrals — warm, tan-tinted grays

```css
--background: oklch(0.99 0.004 80); /* page canvas, near-white */
--foreground: oklch(0.17 0.008 70); /* body text */
--card: oklch(1 0 0); /* pure white surfaces */
--muted: oklch(0.96 0.006 75); /* secondary surfaces, striped rows */
--muted-foreground: oklch(0.48 0.01 70); /* captions, help text */
--border: oklch(0.9 0.008 70); /* hairlines */
--accent: oklch(0.94 0.012 65); /* hover / active states */
```

Every neutral is pulled slightly toward tan (hue ~70–80). The result
reads as "site office" instead of "crypto startup". Resist the urge
to swap any of them for cool slate; the whole palette is calibrated
to sit next to the amber without clashing.

### Semantic

```css
--destructive: oklch(0.55 0.2 27); /* errors, delete confirms */
```

Success, warning, and info are rendered via Tailwind utilities
(`emerald-600`, `amber-600`, `sky-600`) when needed. Don't introduce
a `--success` token until we see the same green used in three or
more places.

### Chart palette

Five hues in `--chart-1` through `--chart-5` — amber / sky / green /
olive / violet, all muted to 0.5–0.7 lightness. Calibrated so a stacked
bar chart of 5 series remains legible without labels.

### Contrast

Body text on background: WCAG AAA. Button label on primary: AA Large.
Any text on amber background (e.g. active pill) uses `--primary-foreground`
which is near-white for safety. Always check a new combination with
a contrast tool before shipping.

### Dark mode

Currently a carry-over from the default shadcn grayscale. **Not tuned
yet** — a proper dark-mode pass will re-tune the amber (drop chroma
~20% so it doesn't buzz on OLED) and rebuild surfaces as layered
near-blacks. Deferred to Phase 3 polish.

---

## 2. Typography

One family everywhere: **Geist** + **Geist Mono**. Already loaded via
`next/font` in `app/layout.tsx`, so there's no CDN dependency or
layout-shift risk. If a future screen wants a display face, stop and
ask — we do not want a second typeface unless there's a compelling
reason.

### Roles

| Role                  | Font       | Weights   | Notes                                |
| --------------------- | ---------- | --------- | ------------------------------------ |
| Body                  | Geist Sans | 400 / 500 | 14–15 px default                     |
| UI / buttons / labels | Geist Sans | 500 / 600 | Tighter line-height                  |
| Headings              | Geist Sans | 600 / 700 | `tracking-tight` on h1               |
| Tables                | Geist Mono | 400       | `font-variant-numeric: tabular-nums` |
| Numeric KPIs          | Geist Mono | 600 / 700 | Mono gives "this is data"            |
| Brand wordmark        | Geist Mono | 700       | `GEI` + `inventory`                  |
| Inline code           | Geist Mono | 400       | Also used for paths in UI            |

Monospace does double duty: it's the typeface for data AND the typeface
for the brand. That consistency is intentional — the product IS the
data, so the brand wears the data's typeface.

### Scale

Use Tailwind's default scale (`text-xs` 12px → `text-2xl` 24px). For
KPI numbers use `text-2xl font-semibold` with `font-mono tabular-nums`
so digits line up across cards.

### Never

- Inter, Roboto, Arial, Helvetica, Open Sans — we already have Geist.
- Serif display faces — fight the mood.
- More than two weights in any single screen.
- ALL CAPS on body — only on tiny labels (`text-xs uppercase tracking-wider`).

---

## 3. Radius

Hierarchical. Size encodes meaning.

```css
--radius: 0.375rem; /* 6px base */
```

| Element         | Radius             | Rationale                                                 |
| --------------- | ------------------ | --------------------------------------------------------- |
| Table cells     | 0                  | Data is sharp. Rounded cells feel like marketing widgets. |
| Inputs, buttons | 4px (`rounded-sm`) | Tight, precise. Invites interaction.                      |
| Cards, popovers | 6px (`rounded-md`) | Default. Enough softness to group content.                |
| Dialogs         | 8px (`rounded-lg`) | Soft enough to feel like "modal" without cartoony bounce. |
| Fully rounded   | `rounded-full`     | Only for avatars and status dots. Never for buttons.      |

The sharp-table / rounded-chrome contrast is deliberate. A table
that looks like a card signals "summary"; a table that looks like
a spreadsheet signals "records". Our tables are records.

---

## 4. Spacing

8px base grid. Tailwind defaults (`space-x-2` = 8px, `p-4` = 16px, etc.)
map cleanly.

### Density guide

| Context         | Gap          | Padding                  | Note                          |
| --------------- | ------------ | ------------------------ | ----------------------------- |
| Dashboard cards | `gap-3`      | `p-4`                    | Comfortable, scannable        |
| Form fields     | `space-y-3`  | `space-y-1.5` inside row | Generous label → input → help |
| Table rows      | (1px border) | `px-2 py-1`              | Dense, Excel-like             |
| Sidebar links   | `py-1.5`     | `px-2.5`                 | Tap targets stay ≥ 32px       |
| Dialog content  | `gap-4`      | `p-4` (shadcn default)   | Breathing room for forms      |

### Max-widths

- **Tables / transactions:** full bleed (no max-width).
- **Forms:** `max-w-xl` (576px) so line length stays readable.
- **Dashboard / pivot / content:** implicit via `<main class="p-6">`
  in `AppShell`; nothing gets wider than the viewport minus sidebar.
- **Marketing (login):** `max-w-[420px]` card on a centered canvas.

### Tap targets

Every clickable element ships at minimum 32×32 px (matches
`size-sm` on shadcn buttons). Tablet users on a worksite wearing
gloves should not have to aim.

---

## 5. Motion

Functional only. No scroll animations, no hero parallax, no page
transitions. The app should feel instant.

| Interaction | Duration | Easing      |
| ----------- | -------- | ----------- |
| Hover state | 120ms    | ease-out    |
| Focus ring  | 150ms    | ease-out    |
| Dialog fade | 200ms    | ease-in-out |
| Toast slide | 200ms    | ease-out    |

Rule of thumb: if an animation exists to delight, cut it. If it
exists to communicate state change, 200ms is the upper bound.

---

## 6. Iconography

`lucide-react` only. No custom SVGs in screens — if a concept
doesn't have a Lucide glyph, question whether you need the icon at all.

### Sidebar icons (current)

| Route        | Icon              |
| ------------ | ----------------- |
| Dashboard    | `LayoutDashboard` |
| Transactions | `List`            |
| Inward       | `ArrowDownToLine` |
| Outward      | `ArrowUpFromLine` |
| Pivot        | `Grid3x3`         |
| Masters      | `Settings`        |

Icons are `h-4 w-4` (16px) at sidebar size, `h-5 w-5` (20px) inside
buttons for primary CTAs, never larger. Always pair icons with
text for our low-literacy audience.

---

## 7. Components in use

All primitives come from `components/ui/` (shadcn `base-nova` style,
backed by `@base-ui/react`). Project-specific components live at
`components/*.tsx`. Never write a custom button — import from
`components/ui/button`.

Reusable patterns shipped so far:

- **`<AppShell>`** — top bar + sidebar + outlet. Wraps every signed-in route.
- **`<SearchableSelect>`** — cmdk-based typeahead. Use for any
  list > 8 options (items, parties, destinations).
- **`<DataGrid>`** — TanStack Table wrapper with `.excel-grid`
  styling and optional row-number gutter.
- **`<ExportButton>`** — CSV + XLSX dropdown. Drop in at the top-right
  of every data table.
- **`<PrintButton>`** — thin `window.print()` wrapper. Pair with
  `print:hide` on sibling chrome.
- **`<ConfirmDialog>`** — destructive or audit-logged actions. When
  `requireReason=true`, a reason input is forced before confirm
  enables; the reason is passed to the server action which sets
  `SET LOCAL app.edit_reason = $reason` for the audit trigger.
- **`<EmptyState>`** — every list/table gets one. Title + optional
  description + optional action button.
- **`<PermissionGate>`** — hides UI unless the current user is allowed
  the module×action on the current site. UI hint only — RLS at the
  DB is the real gate.

---

## 8. Decisions log

| Date       | Decision                                             | Rationale                                                     |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| 2026-04-21 | Industrial-minimal direction                         | Tool-not-showcase; respects six-hour-a-day worker.            |
| 2026-04-21 | Construction amber (`#C2410C`) as primary            | Rare in SaaS, industry-appropriate, memorable.                |
| 2026-04-21 | Geist + Geist Mono only, no display face             | Already bundled; one family ages better than trendy pairings. |
| 2026-04-21 | Hierarchical radius (0 / 4 / 6 / 8)                  | Tables sharp, chrome rounded — encodes "data vs. app".        |
| 2026-04-21 | Warm-gray neutrals (hue 70–80) instead of cool slate | Reads as "site office", not "crypto startup".                 |
| 2026-04-21 | Dark mode deferred to Phase 3                        | Site laptops run daylight mode; not worth complexity in v1.   |
| 2026-04-21 | `middleware.ts` → `proxy.ts` per Next 16             | Eliminate deprecation warning, stay on current convention.    |

---

## 9. Changing this doc

This is a living document, not a constitution. When a screen genuinely
needs a new token or a new pattern, add it and log the decision. When
the same custom value (e.g. a specific padding) shows up in three or
more places, promote it to the doc.

Before landing a UI PR:

1. Did every color come from a token in `:root`? (No raw hex in screens.)
2. Did every spacing value come from the Tailwind scale? (No `p-[13px]`.)
3. Does the screen render correctly at 1024×768 (minimum for tables)
   AND 375 px (forms, dialogs)?
4. Does `print:hide` apply to chrome so `Cmd+P` outputs only the data?
5. Does the design match what a designer would expect given this doc?
