import { useOutletContext } from "react-router";

/** Places in the guest header that a page fills in once the guest has joined. */
export interface GuestHeaderSlots {
  /** The guest's name and its edit action. */
  name: HTMLElement | null;
  /** The receipt icon, once there is a bill to show. */
  bill: HTMLElement | null;
}

/** The header slots of the surrounding guest layout, if there is one. */
export function useGuestHeaderSlots(): GuestHeaderSlots | undefined {
  return useOutletContext<GuestHeaderSlots | undefined>();
}
