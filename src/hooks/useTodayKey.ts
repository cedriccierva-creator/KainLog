import { useEffect, useState } from 'react';
import { todayKey } from '../lib/date';

/**
 * The device's current local day, kept fresh while the app stays open:
 * - a timer fires just after local midnight, then re-arms for the next day;
 * - returning to the foreground re-checks the clock (phones suspend timers);
 * - window focus covers desktop tab switches.
 */
export function useTodayKey(): string {
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    const sync = () => setToday(todayKey());

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sync();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', sync);

    let timer = 0;
    const scheduleMidnight = () => {
      const now = new Date();
      // 50 ms after midnight so the date getter has definitely flipped.
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        50,
      );
      timer = window.setTimeout(() => {
        sync();
        scheduleMidnight();
      }, Math.max(nextMidnight.getTime() - now.getTime(), 0));
    };
    scheduleMidnight();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', sync);
      window.clearTimeout(timer);
    };
  }, []);

  return today;
}
