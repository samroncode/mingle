import type { HostActionError, HostActionResult } from "@/api/host-actions";
import type { Party } from "@/lib/schemas/party";
import type { UpdatePartyContentResponse } from "@/lib/schemas/host-actions";
import {
  invalidFields,
  toParty,
  type PartyField,
  type PartyForm,
} from "@/lib/wizard/state";

/** The saved party content as the wizard's party steps edit it. */
export function partyToForm(party: Party): PartyForm {
  return {
    welcome: party.welcome ?? "",
    welcomeEdited: true,
    menu: [...(party.menu ?? [])],
    schedule: (party.schedule ?? []).map((line) => ({ ...line })),
    wifiSsid: party.wifi?.ssid ?? "",
    wifiPassword: party.wifi?.password ?? "",
    musicUrl: party.musicUrl ?? "",
  };
}

export type PartySaveResult =
  | { ok: true }
  | { ok: false; invalid: PartyField[] }
  | { ok: false; error: HostActionError };

type SendParty = (input: {
  code: string;
  key: string;
  party: Party;
}) => Promise<HostActionResult<UpdatePartyContentResponse>>;

/**
 * Checks the form and sends the whole party object, which replaces the saved
 * one: a part the host cleared is gone from the TV too.
 */
export async function savePartyEdit(
  form: PartyForm,
  target: { code: string; key: string },
  send: SendParty,
): Promise<PartySaveResult> {
  const invalid = invalidFields(form);
  if (invalid.length > 0) return { ok: false, invalid };
  const result = await send({ ...target, party: toParty(form) });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
