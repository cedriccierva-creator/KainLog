/**
 * Tracks how many sheets are mounted. Shared by the Sheet component (which
 * pushes/pops history entries) and the native Back handler (which must close a
 * sheet instead of navigating or exiting).
 */
let openSheetCount = 0;

export function sheetOpened(): void {
  openSheetCount += 1;
}

export function sheetClosed(): void {
  openSheetCount -= 1;
}

export function hasOpenSheet(): boolean {
  return openSheetCount > 0;
}
