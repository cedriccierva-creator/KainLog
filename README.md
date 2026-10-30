# KainLog

Offline-first calorie and macro tracker for Filipino food. Single user, no accounts, no backend:
every record lives in IndexedDB on the device.

## Stack

React 19 + TypeScript (strict) + Vite · Tailwind CSS 3.4 · Dexie 4 with `dexie-react-hooks` ·
React Router 7 · Vitest (+ `fake-indexeddb` for database tests). `vite-plugin-pwa` and Capacitor are
added in their own phases. No chart dependency: the Progress charts are hand-drawn SVG/CSS.

**Pinned tooling.** ESLint **9** and Tailwind **3.4.19** are deliberate pins. ESLint 9 is the flat-config
line that `typescript-eslint` 8 supports; ESLint 10 is newer but its plugins are not needed here yet.
Tailwind 3.4 keeps `darkMode: 'class'` in `tailwind.config.js`; v4 moves theming into CSS and would
force a migration this app does not need. Versions live in `package.json` and are not loosened with
ranges for the build tools.

## Commands

```bash
npm install
npm run dev            # local dev server on 0.0.0.0:5173
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm test               # Vitest (runs under TZ=Asia/Manila)
npm run test:tz        # date tests in Asia/Manila and America/New_York
npm run build          # typecheck + production build
npm run validate:foods # checks src/data/foods.ph.json
```

`test:tz` runs the date suite twice so local-day logic is exercised on both sides of UTC
(UTC+8 and UTC-4/-5). The preview/dev server accepts an extra Host header only when you ask:

```bash
KAINLOG_ALLOWED_HOSTS=.example.dev npm run dev   # comma-separated; nothing is committed
```

## Food library and accuracy

`src/data/foods.ph.json` ships 167 Filipino foods across 11 categories (ulam, fish & seafood,
vegetables, silog & breakfast, rice, noodles, street food, merienda & desserts, drinks, fruits,
fast food). Every seed entry is `verified: false` and `source: "seed-estimate"`, and the UI shows
an **estimate** badge. Values are realistic estimates in the style of the FNRI Philippine Food
Composition Tables — **not** lab-verified values, and the user can edit any of them.

**`npm run validate:foods` checks internal consistency only, not nutritional accuracy.** It fails on:

- missing/empty required fields or wrong types
- unknown categories, or fewer than 150 foods / fewer than 5 per category
- duplicate ids or duplicate names (accent- and case-insensitive)
- alias collisions (an alias matching another food's name or alias, or repeating its own name)
- `servingGrams <= 0`, non-positive or negative alt servings, negative nutrition values
- physically impossible rows: protein+carbs+fat grams heavier than the serving, kcal above
  `9 × servingGrams` (pure fat), or fiber above total carbohydrate
- `verified: true` or a `source` other than `seed-estimate`
- more than 10 fast-food entries, or a fast-food entry whose `notes` omits
  "check the official nutrition info"
- kcal differing from `4 × protein + 4 × carbs + 9 × fat` by more than 20%, unless the entry's
  `notes` carry a justified `kcal-exception:` line (max 10 such entries)

You can validate any file: `node scripts/validate-foods.mjs path/to/file.json`.

## Data rules

- **Local dates only.** Every day boundary is the device's calendar day, stored as `YYYY-MM-DD`.
  `toISOString()` is banned by ESLint because a meal at 11:59 pm would otherwise shift days.
- **Snapshots.** A `LogEntry` stores the food's **per-serving** values plus `servings`, along with
  `foodName` and `servingLabel`. Totals = snapshot × servings, so editing a food later can never
  rewrite past days, and entries stay readable if the food is deleted.
- **Seeding inserts, then refreshes untouched rows.** `seedDatabase()` adds any missing seed ids and
  records `seedVersion` in `meta`. On a version bump it refreshes only `source: "seed-estimate"` rows
  (nutrition, aliases, alt servings, notes), always keeps `hidden`, and never touches `source: "user"`
  rows — so user edits and hidden flags survive.
- **Hidden, not deleted.** Seed foods get a `hidden` flag instead of being removed. Hidden foods
  disappear from search and Add Food but their snapshots still render in past diary entries.
- **Badges tell the truth.** Seed rows show an `estimate` badge; editing any food saves it as
  `source: "user"`, which flips the badge to `custom`. `verified` is always false.
- **Full precision, display rounding.** Entries store exact per-serving values and servings; totals
  are summed unrounded (`src/lib/nutrition.ts`). Rounding happens only in `src/lib/format.ts`.
- **Custom meals expand.** Logging a meal writes one snapshot entry per item, so each component can
  be edited or deleted on its own.

## Goals math

Profile uses Mifflin-St Jeor: `10×kg + 6.25×cm − 5×age + 5` (male) or `−161` (female), times an
activity multiplier of 1.2 / 1.375 / 1.55 / 1.725 / 1.9. The suggestion is maintenance −500 kcal for
a loss goal, +300 kcal for a gain goal, clamped to an adult floor (1200 kcal female, 1500 kcal male),
rounded to the nearest 10, and labelled an estimate — not medical advice. The user can override the
target; a manual target must still fall between 1000 and 6000 kcal. Default macros are ~1.6 g/kg
protein, 25% of kcal from fat, carbs for the rest; the UI warns (does not block) when 4P+4C+9F differs
from the kcal target by more than 2%.

## Backup format

Export writes one JSON file: `app: "kainlog"`, `schemaVersion: 1`, `seedVersion`, `exportedAt` (the one
allowed `toISOString()`), and every table (`foods`, `logEntries`, `customMeals`, `weightEntries`,
`profile`, `meta`). Import validates the app marker, schema version and every row by hand — no schema
library — **before** touching IndexedDB. A rejected file leaves the database untouched. A valid file
replaces all tables in one Dexie transaction, then re-seeds. The file is also the way to move data
between devices: there is no cloud sync.

## Dark mode

The toggle is stored in `meta` (`theme`) and applied as a class on `<html>`. With no stored choice the
app follows `prefers-color-scheme`. `index.html` has a tiny inline script that sets the class before
first paint so there is no light flash; it mirrors the choice in `localStorage` **only** for that
pre-paint read — the canonical value stays in IndexedDB and no app data is stored in localStorage.

## Screens (Phase 2)

- **Diary** — date switcher, remaining-calories ring, macro bars, four meal sections, recent-food
  chips (re-log in 2 taps), tap-to-edit servings, delete button, "Set your goals" banner while the
  placeholder 2000 kcal profile is active.
- **Add Food** — autofocused search with category chips, recent/frequent foods, quick-portion chips,
  quarter-step stepper, live nutrition preview, and custom-meal logging.
- **Foods** — browse/search the library (including hidden), create and edit foods, hide/unhide, and
  create/edit custom meals.

## Screens (Phase 3)

- **Profile** — sex, age, height, weight, activity, goal; live BMR/maintenance/suggested target,
  editable kcal target and macros, macro-mismatch warning, save clears the placeholder banner.
- **Progress** — 7 days of kcal vs target (bars, dashed target line, days with nothing logged shown
  as "no data" and excluded from the average), plus a weight log (one entry per date, upsert) with a
  hand-drawn 7-day moving-average trend.
- **Backup and appearance** live on the Profile screen: export/import JSON with a confirmation sheet,
  and the dark-mode switch.

## Status

Phases 1–2 complete: schema, seed library, validator, search, calorie math, diary, Add Food, Foods,
custom meals, tests. Phase 3 adds goals, progress, backup and dark mode. PWA + Android are Phase 4.

## Tests

`npm test` covers date keys on both sides of UTC, nutrition rescaling, search ranking, seed upgrades,
sheet focus/Back behaviour, midnight rollover, missing foods in meal expansion, TDEE with hand-computed
values, weekly averages that skip empty days, moving averages, backup round-trips and rejection, and
the UI flows. `npm run test:tz` repeats the date suite in Asia/Manila and America/New_York.
