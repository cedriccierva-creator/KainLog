# Phase 0 plan — grams, per-100 g, basics library, food import

**Schema: additive only — no Dexie version bump, no backup `schemaVersion` bump.**
- `FoodSnapshot.servingGrams?: number` (new entries always set it) + `LogEntry.amountMode?: 'servings' | 'grams'`.
- `FoodCategory` += poultry, meat, eggs-dairy, grains-bread, legumes-nuts, oils-condiments, snacks-sweets, other.
- Why: no index changes needed; old rows simply lack the fields (servings-only) and v1 backups still validate because optional/unknown keys are ignored both ways.

**New files:** `src/data/foods.basic.json`, `src/lib/foodImport.ts`, `src/lib/fileShare.ts`, `src/components/AmountField.tsx`, `src/test/{foodImport,grams}.test.tsx`, `src/test/fixtures/v1-backup.json`.
**Edited:** `types.ts`, `nutrition.ts`, `categories.ts`, `search.ts`, `db/{seed,logActions,backup}.ts`, `scripts/validate-foods.mjs`, `package.json`.
**Cache sweep:** one `sweepStaleExports(prefixes)` helper in `src/lib/backupFile.ts`; backups and the import template each pass their own filename prefix. No separate `fileShare.ts`.
**Edited UI:** `AddFoodScreen`, `DiaryScreen`, `FoodFormSheet`, `MealFormSheet`, `FoodsScreen`, `ui.tsx`.
**Phases:** 1 grams toggle (Add Food, entry edit, custom-meal items) + snapshot grams + "167 g" diary + servings guards; 2 per-100 g form with live per-serving preview + 4/4/9 kcal + >20% warning; 3 80+ basics with cooking states, `SEED_VERSION` 3→4, per-file validator, and token-based search (all query words must match a word start or substring in the name or an alias, punctuation ignored) with tests for "chicken breast fried", "chicken breast (fried)", "fried chicken breast", "breast fried"; 4 JSON import (validate whole file → preview → one transaction) + template share + docs.

**Risks**
- Serving writes are guarded (finite, >0, ≤10000); the stepper still snaps to quarters and never reaches zero.
- Diary grams must be rounded only in `format.ts`, and must stay float-safe for non-terminating ratios (30/45/85/180 g servings; 47/47.5/167 g amounts).
- Search acceptance ("chicken breast" variants, "fried chicken") depends on names/aliases and Phase 3's token matcher; explicit search tests required.
- Seed merge can collide names/aliases across files; validator must check the combined set while keeping minimums per file; seed files never use `other`.
- New categories must be mirrored in types, labels, backup parser and validator (parity test), and unknown imported categories map to `other`.
- WebView `.json` picker and native template share are unverifiable here: mocked plugin test + manual phone step.
- Assumption: diary shows grams only for entries logged in grams, hence the optional `amountMode` flag.
- No destructive ops: seed inserts missing ids, refreshes only unedited `seed-estimate` rows, preserves `hidden` and `source:"user"`.
- Gate each phase: typecheck, lint, test, test:tz, build, validate:foods; one local commit, then stop for approval.
