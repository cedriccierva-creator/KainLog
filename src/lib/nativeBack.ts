/** What a hardware/gesture Back press should do inside the Android WebView. */
export type BackAction = 'close-sheet' | 'go-back' | 'exit';

export function decideNativeBack(sheetOpen: boolean, atHome: boolean): BackAction {
  if (sheetOpen) return 'close-sheet';
  if (!atHome) return 'go-back';
  return 'exit';
}
