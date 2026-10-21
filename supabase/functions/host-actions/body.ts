// Reads a request body without ever holding more than the cap in memory, so
// an oversized body is refused before anything parses it.

/** Every host-actions body fits well within this, party content included. */
export const MAX_BODY_BYTES = 32 * 1024;

export type BodyResult =
  | { ok: true; json: unknown }
  | { ok: false; error: "payload_too_large" | "invalid_request" };

export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<BodyResult> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > maxBytes) {
    await request.body?.cancel();
    return { ok: false, error: "payload_too_large" };
  }

  const bytes = await readCapped(request.body, maxBytes);
  if (bytes === null) return { ok: false, error: "payload_too_large" };

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, json: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "invalid_request" };
  }
}

/** The whole stream, or null as soon as it grows past `maxBytes`. */
async function readCapped(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (stream === null) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
