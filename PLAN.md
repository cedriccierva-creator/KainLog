# KainLog — Plan (Phase 0, no code yet)

## Plan (25 lines max)

1. Phase 1 — Foundation: Vite + React + TS (strict) scaffold, Tailwind with dark-mode tokens, Dexie v4 schema, idempotent seed loader, `foods.ph.json` (150+), validator, `search()`, nutrition math, Vitest suites.
2. Search: lowercase + NFD strip diacritics; match `name` and `aliases`; rank prefix(0) > word-prefix(1) > substring(2); tie-break by shorter name; tested on "adobo", "sinigan", "pansit", "tapsilog".
3. Dates: one helper `localDateKey()` built from local `getFullYear/getMonth/getDate`; every query keys on that string; never `toISOString`. Tested at 23:59 local.
4. Snapshots: each `LogEntry` stores kcal/protein/carbs/fat/fiber/sodium at logging time, and all totals are computed only from snapshots, so editing a food cannot rewrite past days.
5. Phase 2 — Diary: date switcher, remaining-kcal ring, 3 macro bars, 4 meal sections, recent strip (re-log in ≤3 taps), tap-to-edit servings, delete button.
6. Phase 2 — Add Food: autofocused search, category chips, Recent + Frequent, serving stepper (0.25 steps) and alt-serving picker, then Add.
7. Phase 2 — Foods: browse/search library, create + edit foods (all values editable), create + edit custom meals; logging a meal expands into individual snapshot entries.
8. Phase 3 — Profile: stats form, Mifflin-St Jeor TDEE, activity multipliers, suggested target with manual override; stores target macros.
9. Phase 3 — Progress: Recharts 7-day kcal-vs-target bar chart, weight log + trend line; backup Export/Import JSON; dark mode toggle persisted in IndexedDB `meta`.
10. Phase 4 — PWA: vite-plugin-pwa manifest + icons + precached service worker; Capacitor config; `BUILD_ANDROID.md`; no SDK/Studio installs.
11. Every phase ends with real output from `typecheck`, `lint`, `test`, `build`, `validate:foods`, and a manual checklist; I stop for approval before the next phase.

## File tree (target at end of Phase 1)

```
KainLog/
├─ PLAN.md  README.md  BUILD_ANDROID.md        # BUILD_ANDROID.md only in Phase 4
├─ index.html  package.json  tsconfig.json  tsconfig.node.json
├─ vite.config.ts  tailwind.config.js  postcss.config.js  eslint.config.js
├─ scripts/validate-foods.mjs                  # plain Node, reads the JSON, no extra deps
├─ public/icons/                               # Phase 4: 192/512/maskable PNG
└─ src/
   ├─ main.tsx  App.tsx  index.css  vite-env.d.ts
   ├─ data/foods.ph.json                       # 150+ Filipino entries
   ├─ db/db.ts                                 # Dexie tables + indexes
   ├─ db/seed.ts                               # insert-missing-only seeding
   ├─ lib/date.ts  lib/nutrition.ts  lib/search.ts
   ├─ types.ts                                 # Food, LogEntry, CustomMeal, Profile, WeightEntry
   └─ test/{search,nutrition,date}.test.ts     # Phase 2+: snapshot/backup tests
```

## Assumptions (one line each)

1. Router: `HashRouter` — offline deep links and future Capacitor `file://` serving both work without server rewrites; does not affect installability.
2. Tailwind **v3.4** (config-based `darkMode: 'class'`) instead of v4 for stable, well-documented setup.
3. Dev-only tooling added beyond the locked stack: `eslint` + `typescript-eslint`, `fake-indexeddb` (for Dexie tests in Node), `@vitest/coverage` not used. **No runtime dependency** is added; Recharts is used only in Phase 3 charts.
4. Editing a food flips `source` to `"user"` (badge changes from "estimate" to "custom"); the seeder only ever inserts missing ids, so edits and user foods survive reloads.
5. Seed ids are stable slugs (`seed-pork-adobo`); user records use `crypto.randomUUID()`.
6. Custom meals store `items[]`; logging one writes one `LogEntry` per item (so portions stay adjustable per component).
7. A placeholder profile (2000 kcal target) is created on first run so the Diary renders before stats are entered.
8. Import replaces all tables inside one Dexie transaction after a confirm dialog; single JSON file via Blob download (no network).
9. Validator: kcal-vs-macro mismatch >20% fails **unless** the entry's `notes` contains `kcal-exception:` with a one-line reason.
10. Fiber/sodium are stored per food and shown on the food detail, but there are no daily micro targets (out of scope).
11. PWA icons are generated locally inside this folder (no runtime network, no paid tooling).

## Approved Phase 1 amendments (applied)

- LogEntry snapshot = **per-serving** nutrition + `servings`, plus `foodName` and `servingLabel`;
  totals are always snapshot × servings. Tested: servings rescaling, food-edit isolation, food deletion.
- Date tests run under `TZ=Asia/Manila` (00:30 and 23:59) and `TZ=America/New_York` with fake timers;
  ESLint bans `toISOString()` everywhere except the future backup timestamp.
- Seeding records `seedVersion` in `meta`, is insert-only, and uses a `hidden` flag instead of deletion.
- `dexie-react-hooks` is a declared dependency.
- `validate:foods` enforces size, per-category minimums, unique ids/names, alias collisions, allowed
  categories, `servingGrams > 0`, fast-food notes, and ≤10 justified kcal exceptions. README states
  the validator checks internal consistency, not accuracy.
- One commit per approved phase.
