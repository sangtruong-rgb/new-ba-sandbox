import { useSyncExternalStore } from 'react';

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}

const currentMinute = () => Math.floor(Date.now() / 60_000);

/** The current time to the minute; re-renders the caller when the minute changes. */
export function useNow(): Date {
  return new Date(useSyncExternalStore(subscribe, currentMinute) * 60_000);
}
