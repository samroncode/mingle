import { useEffect, useRef, useState } from "react";

/** How long each part of the party screen stays before the next one. */
export const ROTATION_MS = 12_000;

/** The key to show: `key` if it is still in the list, else the first. */
export function resolveKey(keys: string[], key: string): string | undefined {
  return keys.includes(key) ? key : keys[0];
}

/** The key after `key`, wrapping around; a vanished key restarts the list. */
export function advance(keys: string[], key: string): string | undefined {
  const current = resolveKey(keys, key);
  if (current === undefined) return undefined;
  return keys[(keys.indexOf(current) + 1) % keys.length];
}

/**
 * The key to move to when `key` has left the list: the first key that was
 * after it in the `previous` list and still exists, else the first key.
 */
export function successor(
  previous: string[],
  keys: string[],
  key: string,
): string | undefined {
  const at = previous.indexOf(key);
  if (at === -1) return keys[0];
  const after = [...previous.slice(at + 1), ...previous.slice(0, at)];
  return after.find((candidate) => keys.includes(candidate)) ?? keys[0];
}

/** Calls `onChange` with the next key every `ms`; returns a stop function. */
export function startRotation(
  getKeys: () => string[],
  initial: string,
  ms: number,
  onChange: (key: string) => void,
): () => void {
  let current = initial;
  const timer = setInterval(() => {
    const next = advance(getKeys(), current);
    if (next === undefined) return;
    current = next;
    onChange(next);
  }, ms);
  return () => clearInterval(timer);
}

/** The key to show now, rotating through `keys` every 12 seconds. */
export function useRotation(keys: string[]): string | undefined {
  const [key, setKey] = useState(keys[0] ?? "");
  const keysRef = useRef(keys);
  useEffect(() => {
    const next = successor(keysRef.current, keys, key);
    keysRef.current = keys;
    // The part on screen is gone: move on and let the timer start over.
    if (next !== undefined && !keys.includes(key)) setKey(next);
  }, [keys, key]);
  useEffect(
    () => startRotation(() => keysRef.current, key, ROTATION_MS, setKey),
    // Restarted on each change so the timer counts from what is shown.
    [key],
  );
  return resolveKey(keys, key);
}
