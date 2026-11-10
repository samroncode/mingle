import i18n from "i18next";

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Gives a person time to tick the checkbox when Cloudflare asks for one. */
const TOKEN_TIMEOUT_MS = 60_000;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "before-interactive-callback": () => void;
      "after-interactive-callback": () => void;
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

/**
 * A themed dialog that stays hidden (and out of the way) until Cloudflare
 * needs a checkbox. The widget sits in `slot`; the dialog must stay clickable
 * (pointer-events:none would be inherited by the iframe and block the box).
 */
function createDialog(): { root: HTMLElement; slot: HTMLElement } {
  const root = document.createElement("div");
  root.style.cssText =
    "display:none;position:fixed;inset:0;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.6);z-index:2147483647";
  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:16px;max-width:360px;padding:24px;text-align:center;background:var(--paper);color:var(--on-paper);border:var(--border-chunky) solid var(--edge);border-radius:var(--radius-md);box-shadow:6px 6px 0 var(--edge);font-family:var(--font-display);font-weight:700";
  const hint = document.createElement("p");
  hint.textContent = i18n.t("captcha.hint");
  hint.style.margin = "0";
  const slot = document.createElement("div");
  card.append(hint, slot);
  root.append(card);
  document.body.append(root);
  return { root, slot };
}

/**
 * Runs Cloudflare Turnstile in managed mode (invisible unless Cloudflare is
 * unsure) and resolves with a single-use token. Rejects when the check
 * fails, expires or times out.
 */
export async function getCaptchaToken(siteKey: string): Promise<string> {
  const api = await loadTurnstile();
  const { root, slot } = createDialog();
  let widgetId: string | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      const fail = () => reject(new Error("The CAPTCHA check failed."));
      const timer = setTimeout(fail, TOKEN_TIMEOUT_MS);
      widgetId = api.render(slot, {
        sitekey: siteKey,
        appearance: "interaction-only",
        callback: (token) => {
          clearTimeout(timer);
          resolve(token);
        },
        "before-interactive-callback": () => {
          root.style.display = "flex";
        },
        "after-interactive-callback": () => {
          root.style.display = "none";
        },
        "error-callback": fail,
        "expired-callback": fail,
        "timeout-callback": fail,
      });
    });
  } finally {
    if (widgetId !== undefined) api.remove(widgetId);
    root.remove();
  }
}
