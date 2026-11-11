/** Whether a key event comes from a field the user is typing in. */
export function isTyping(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return false;
  const { tagName, isContentEditable } = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
  };
  if (isContentEditable === true) return true;
  return (
    typeof tagName === "string" &&
    ["INPUT", "TEXTAREA", "SELECT"].includes(tagName.toUpperCase())
  );
}
