import type { HostActionError, HostActionResult } from "@/api/host-actions";
import type { UpdatePartyContentResponse } from "@/lib/schemas/host-actions";
import type { Party } from "@/lib/schemas/party";

type SendParty = (input: {
  code: string;
  key: string;
  party: Party;
}) => Promise<HostActionResult<UpdatePartyContentResponse>>;

export type TvPinResult = { ok: true } | { ok: false; error: HostActionError };

/** `saved` with the pin set, or removed when `key` is undefined. */
export function withTvPin(saved: Party, key: string | undefined): Party {
  const rest = { ...saved };
  delete rest.tvPin;
  return key === undefined ? rest : { ...rest, tvPin: key };
}

/**
 * Locks the TV on the part `key`, or lets the parts take turns again with
 * `undefined`. The rest of the party content is carried over untouched,
 * because saving replaces the whole party object.
 */
export async function saveTvPin(
  key: string | undefined,
  saved: Party,
  target: { code: string; key: string },
  send: SendParty,
): Promise<TvPinResult> {
  const result = await send({ ...target, party: withTvPin(saved, key) });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
