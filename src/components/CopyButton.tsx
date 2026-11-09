import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  text: string;
  label: string;
  size?: "default" | "sm";
}

/** Copies `text` to the clipboard and says so for a moment. */
export function CopyButton({ text, label, size }: CopyButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the text stays visible to copy by hand.
    }
  }

  return (
    <Button
      variant="outline"
      size={size}
      aria-label={label}
      onClick={() => void copy()}
    >
      {copied ? t("common.copied") : t("common.copy")}
    </Button>
  );
}
