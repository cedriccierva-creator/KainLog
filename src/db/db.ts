import Dexie, { type Table } from 'dexie';
import type {
  CustomMeal,
  Food,
  LogEntry,
  MetaRecord,
  Profile,
  WeightEntry,
} from '../types';

/**
 * IndexedDB schema. Indexes are only declared for fields we filter/sort on.
 * Booleans (isFilipino, verified, hidden) are deliberately NOT indexed:
 * IndexedDB cannot index boolean values.
 */
export class KainLogDB extends Dexie {
  foods!: Table<Food, string>;
  logEntries!: Table<LogEntry, string>;
  customMeals!: Table<CustomMeal, string>;
  weightEntries!: Table<WeightEntry, string>;
  profile!: Table<Profile, 'me'>;
  meta!: Table<MetaRecord, string>;

  constructor(name = 'kainlog') {
    super(name);
    this.version(1).stores({
      foods: 'id, name, category, source',
      logEntries: 'id, date, meal, foodId, [date+meal]',
      customMeals: 'id, name',
      weightEntries: 'date',
      profile: 'id',
      meta: 'key',
    });
  }
}

/** The one database used by the app. Tests instantiate KainLogDB with another name. */
export const db = new KainLogDB();
