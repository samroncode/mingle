interface WakeLockSentinelLike {
  release(): Promise<void>;
}

interface WakeLockNavigator {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
}

interface VisibilityDocument {
  visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/**
 * Asks the browser to keep the screen awake, and asks again whenever the tab
 * becomes visible (the browser drops the lock when it is hidden). Does nothing
 * where the Screen Wake Lock API is missing. Returns a function that stops it.
 */
export function keepScreenAwake(
  nav: WakeLockNavigator,
  doc: VisibilityDocument,
): () => void {
  const wakeLock = nav.wakeLock;
  if (!wakeLock) return () => {};

  let stopped = false;
  let held: Promise<WakeLockSentinelLike | undefined> =
    Promise.resolve(undefined);

  function releaseHeld(): void {
    void held.then((sentinel) => sentinel?.release().catch(() => {}));
  }

  function acquire(): void {
    // The one held so far is replaced, so it must not stay locked behind it.
    releaseHeld();
    held = wakeLock!.request("screen").then(
      (sentinel) => {
        if (!stopped) return sentinel;
        void sentinel.release();
        return undefined;
      },
      // Refused, for example on low battery; the next visible tab retries.
      () => undefined,
    );
  }

  function onVisibilityChange(): void {
    if (doc.visibilityState === "visible") acquire();
  }

  doc.addEventListener("visibilitychange", onVisibilityChange);
  acquire();

  return () => {
    stopped = true;
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    releaseHeld();
  };
}
