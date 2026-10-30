import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

import type { ChoiceFill, ChoiceState } from "./choiceState";

interface ChoiceTileProps {
  fill: ChoiceFill;
  label: ReactNode;
  /** Shown before the label, such as an option letter or an icon. */
  leading?: ReactNode;
  state: ChoiceState;
  onPress: () => void;
  /** `lg` is the taller, centred tile used for two big answers. */
  size?: "md" | "lg";
}

/**
 * The fill and text of each fill in each state. Once another tile is chosen, a
 * bright tile steps back to its soft fill. A paper tile turns champagne once chosen.
 */
const fills: Record<ChoiceFill, Record<ChoiceState, string>> = {
  coral: {
    idle: "bg-coral text-on-bright",
    chosen: "bg-coral text-on-bright",
    "other-chosen": "bg-coral-soft-fill text-on-bright",
  },
  champagne: {
    idle: "bg-champagne text-on-bright",
    chosen: "bg-champagne text-on-bright",
    "other-chosen": "bg-champagne-soft-fill text-on-bright",
  },
  blush: {
    idle: "bg-blush text-on-bright",
    chosen: "bg-blush text-on-bright",
    "other-chosen": "bg-blush-soft-fill text-on-bright",
  },
  sage: {
    idle: "bg-sage text-on-bright",
    chosen: "bg-sage text-on-bright",
    "other-chosen": "bg-sage-soft-fill text-on-bright",
  },
  paper: {
    idle: "bg-paper text-on-paper",
    chosen: "bg-champagne text-on-bright",
    "other-chosen": "bg-paper text-on-paper",
  },
};

const sizes = {
  md: {
    tile: "min-h-16 text-left text-xl font-bold",
    label: "flex-1",
    check: "size-6",
  },
  lg: {
    tile: "min-h-20 justify-center text-2xl font-extrabold",
    label: "",
    check: "size-7",
  },
};

/**
 * One answer a guest can press, shared by every activity. The chosen tile is
 * pressed in and checked; every tile stays pressable so the guest can change
 * their answer.
 */
export function ChoiceTile({
  fill,
  label,
  leading,
  state,
  onPress,
  size = "md",
}: ChoiceTileProps) {
  const chosen = state === "chosen";
  const look = sizes[size];
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onPress}
      className={cn(
        "fun-lift flex items-center gap-3 rounded-md border-[length:var(--border-chunky)] border-edge px-4 py-3 font-display shadow-pop-sm transition-[transform,box-shadow] duration-(--duration-fast)",
        look.tile,
        fills[fill][state],
        chosen && "translate-x-[3px] translate-y-[3px] shadow-none",
      )}
    >
      {leading}
      {look.label ? <span className={look.label}>{label}</span> : label}
      {chosen && <Check aria-hidden strokeWidth={3} className={look.check} />}
    </button>
  );
}
