import type { MemberRow } from "@/api/events";

/** The guests in an event: the TV and the host are members too, but don't answer. */
export function countGuests(members: MemberRow[]): number {
  return members.filter((member) => member.role === "guest").length;
}

/** How many have answered: at least the guest themselves, once they have. */
export function answeredCount(counted: number, iAnswered: boolean): number {
  return Math.max(counted, iAnswered ? 1 : 0);
}
