import { Sticker } from "@/components/ui/sticker";

/** "Question 3 of 10" as a small tilted label above a phone screen's heading. */
export function Counter({ children }: { children: string }) {
  return (
    <Sticker color="champagne" lean="left" className="self-start">
      {children}
    </Sticker>
  );
}
