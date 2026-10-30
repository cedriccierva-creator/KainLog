/** What a hardware/gesture Back press should do inside the Android WebView. */
export type BackAction = 'close-sheet' | 'go-diary' | 'go-back' | 'exit';

/**
 * Tab screens (Foods, Progress, Profile) return to the Diary; only pushed
 * screens such as Add Food pop their own history entry. Back at the Diary
 * exits, matching the platform expectation for a root screen.
 */
export function decideNativeBack(sheetOpen: boolean, pathname: string): BackAction {
  if (sheetOpen) return 'close-sheet';
  if (pathname === '/') return 'exit';
  if (pathname === '/add') return 'go-back';
  return 'go-diary';
}
