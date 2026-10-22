const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Gives a person time to tick the checkbox when Cloudflare asks for one. */
const TOKEN_TIMEOUT_MS = 120_000;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

let scriptLoad: Promise<TurnstileApi> | undefined;

function turnstileOnWindow(): TurnstileApi | undefined {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

/** Loads Cloudflare's script once; a failed load can be tried again. */
function loadTurnstile(): Promise<TurnstileApi> {
  scriptLoad ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const api = turnstileOnWindow();
      if (api) resolve(api);
      else reject(new Error("Turnstile did not start."));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Turnstile could not be loaded."));
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    scriptLoad = undefined;
    throw error;
  });
  return scriptLoad;
}

/** A box that stays out of the way until Cloudflare needs a checkbox. */
function createContainer(): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:2147483647";
  document.body.append(container);
  return container;
}

/**
 * Runs Cloudflare Turnstile in managed mode (invisible unless Cloudflare is
 * unsure) and resolves with a single-use token. Rejects when the check
 * fails, expires or times out.
 */
export async function getCaptchaToken(siteKey: string): Promise<string> {
  const api = await loadTurnstile();
  const container = createContainer();
  let widgetId: string | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      const fail = () => reject(new Error("The CAPTCHA check failed."));
      const timer = setTimeout(fail, TOKEN_TIMEOUT_MS);
      widgetId = api.render(container, {
        sitekey: siteKey,
        appearance: "interaction-only",
        callback: (token) => {
          clearTimeout(timer);
          resolve(token);
        },
        "error-callback": fail,
        "expired-callback": fail,
        "timeout-callback": fail,
      });
    });
  } finally {
    if (widgetId !== undefined) api.remove(widgetId);
    container.remove();
  }
}
