import { PartySchema, type Party } from "@/lib/schemas/party";

/** The party content of an event row; anything invalid counts as empty. */
export function readParty(value: unknown): Party {
  const parsed = PartySchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
