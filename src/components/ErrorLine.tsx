import type { ReactNode } from "react";

export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-bold text-danger-text">
      {children}
    </p>
  );
}
