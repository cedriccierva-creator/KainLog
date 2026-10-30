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
npm test               # Vitest
npm run build          # typecheck + production build
npm run validate:foods # checks src/data/foods.ph.json
```

`npm test` runs the suite twice — `TZ=Asia/Manila`, then `TZ=America/New_York` for the date
tests — so local-day logic is exercised on both sides of UTC.

## Food library and accuracy

`src/data/foods.ph.json` ships 166 Filipino foods across 11 categories (ulam, fish & seafood,
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
- **Hidden, not deleted.** Seed foods get a `hidden` flag instead of being removed.

## Status

Phase 1 (foundation) complete: schema, seed library, validator, search, calorie math, tests.
Screens arrive in Phase 2. Backup/restore in Phase 3. PWA + Android in Phase 4.
