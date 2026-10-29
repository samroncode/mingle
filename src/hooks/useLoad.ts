import { useEffect, useState } from "react";
import type { Result } from "@/api/errors";

/** What a view renders for a read: in flight, done, or failed. */
export type LoadState<T> =
  { status: "loading" } | { status: "ready"; value: T } | { status: "error" };

export type LoadOptions = {
  /** Does nothing while false. Default true. */
  enabled?: boolean;
  /** Reads again whenever this changes. */
  refresh?: number;
  /** A failed read keeps the last value for the same key instead of failing. */
  keepOnError?: boolean;
};

/** A finished read and the key it belongs to. */
export type Loaded<T> = {
  key: string;
  state: Exclude<LoadState<T>, { status: "loading" }>;
};

/**
 * Runs `load` and reports its outcome (a throw counts as a failure) unless the
 * returned function is called first; then the late answer is dropped.
 */
export function startLoad<T>(
  load: () => Promise<Result<T, string>>,
  onDone: (result: Result<T, string>) => void,
): () => void {
  let stale = false;
  void load()
    .catch((): Result<T, string> => ({ ok: false, error: "unknown" }))
    .then((result) => {
      if (!stale) onDone(result);
    });
  return () => {
    stale = true;
  };
}

/** What is stored after a read of `key` finishes. */
export function nextLoaded<T>(
  previous: Loaded<T> | undefined,
  key: string,
  result: Result<T, string>,
  keepOnError: boolean,
): Loaded<T> {
  if (result.ok)
    return { key, state: { status: "ready", value: result.value } };
  if (keepOnError && previous?.key === key && previous.state.status === "ready")
    return previous;
  return { key, state: { status: "error" } };
}

/** The state for `key`: whatever was stored for another key is not it. */
export function stateFor<T>(
  loaded: Loaded<T> | undefined,
  key: string,
): LoadState<T> {
  return loaded?.key === key ? loaded.state : { status: "loading" };
}

/**
 * Reads data when `key` changes (and when `refresh` changes), and ignores
 * answers that arrive after the key changed or the component unmounted.
 */
export function useLoad<T>(
  key: string,
  load: () => Promise<Result<T, string>>,
  { enabled = true, refresh, keepOnError = false }: LoadOptions = {},
): LoadState<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>();

  useEffect(() => {
    if (!enabled) return;
    return startLoad(load, (result) =>
      setLoaded((previous) => nextLoaded(previous, key, result, keepOnError)),
    );
    // `load` is a new closure every render; the key stands for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, refresh, keepOnError]);

  return stateFor(loaded, key);
}
