# KainLog

Offline-first calorie and macro tracker for Filipino food. Single user, no accounts, no backend:
every record lives in IndexedDB on the device.

## Stack

React 19 + TypeScript (strict) + Vite · Tailwind CSS 3.4 · Dexie 4 with `dexie-react-hooks` ·
Vitest (+ `fake-indexeddb` for database tests). React Router, `vite-plugin-pwa`, Recharts and
Capacitor are added in their own phases.

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
- **Insert-only seeding.** `seedDatabase()` adds only missing seed ids, records `seedVersion` in
  the `meta` table, and never touches existing rows — so user edits and hidden flags survive.
- **Hidden, not deleted.** Seed foods get a `hidden` flag instead of being removed. Hidden foods
  disappear from search and Add Food but their snapshots still render in past diary entries.
- **Badges tell the truth.** Seed rows show an `estimate` badge; editing any food saves it as
  `source: "user"`, which flips the badge to `custom`. `verified` is always false.
- **Full precision, display rounding.** Entries store exact per-serving values and servings; totals
  are summed unrounded (`src/lib/nutrition.ts`). Rounding happens only in `src/lib/format.ts`.
- **Custom meals expand.** Logging a meal writes one snapshot entry per item, so each component can
  be edited or deleted on its own.

## Screens (Phase 2)

- **Diary** — date switcher, remaining-calories ring, macro bars, four meal sections, recent-food
  chips (re-log in 2 taps), tap-to-edit servings, delete button, "Set your goals" banner while the
  placeholder 2000 kcal profile is active.
- **Add Food** — autofocused search with category chips, recent/frequent foods, quick-portion chips,
  quarter-step stepper, live nutrition preview, and custom-meal logging.
- **Foods** — browse/search the library (including hidden), create and edit foods, hide/unhide, and
  create/edit custom meals.

Progress and Profile are Phase 3.

## Status

Phase 1 (foundation) complete: schema, seed library, validator, search, calorie math, tests.
Screens arrive in Phase 2. Backup/restore in Phase 3. PWA + Android in Phase 4.
