const MAX_MESSAGE = 300;
const MAX_STACK = 1000;

/** Removes the query and fragment from every URL, and any stray `key=` value. */
export function stripUrlSecrets(text: string): string {
  return text
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s)'"<>#?]*)[#?][^\s)'"<>]*/gi, "$1")
    .replace(/#[^\s)'"<>]*/g, "")
    .replace(/\bkey=[^\s&)'"<>]*/gi, "key=");
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

/** A message that is safe to send: no URL query or fragment, cut short. */
export function cleanMessage(text: string): string {
  return truncate(stripUrlSecrets(text), MAX_MESSAGE);
}

/** A stack that is safe to send: no URL query or fragment, cut short. */
export function cleanStack(text: string): string {
  return truncate(stripUrlSecrets(text), MAX_STACK);
}

export interface CaughtError {
  name: string;
  message: string;
  stack?: string;
}

/** Reads whatever was thrown or rejected into a name, message and stack. */
export function describeThrown(value: unknown): CaughtError {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === "string") return { name: "Error", message: value };
  return { name: "Error", message: "non_error_value" };
}

/** The host of a URL, or "unknown". Never the path, query or fragment. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host || url.slice(0, 20);
  } catch {
    return url === "inline" || url === "eval" || url === "data"
      ? url
      : "unknown";
  }
}
