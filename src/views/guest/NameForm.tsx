import { ErrorLine } from "@/components/ErrorLine";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { JoinErrorCode, RenameErrorCode } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayNameMaxLength } from "@/lib/guest/display-name";

interface NameFormProps {
  label: string;
  submitLabel: string;
  initialName?: string;
  /** Put the cursor in the field at once, for a form the guest just opened. */
  autoFocus?: boolean;
  /** Resolves to an error code, or nothing on success. */
  onSubmit: (
    name: string,
  ) => Promise<JoinErrorCode | RenameErrorCode | undefined>;
}

/** A display-name field with a button; used to join and to rename. */
export function NameForm({
  label,
  submitLabel,
  initialName = "",
  autoFocus = false,
  onSubmit,
}: NameFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<JoinErrorCode | RenameErrorCode>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    const code = await onSubmit(name);
    setBusy(false);
    setError(code);
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4"
    >
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{label}</span>
        <Input
          value={name}
          maxLength={displayNameMaxLength}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={error !== undefined}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {error && <ErrorLine>{t(`guest.errors.${error}`)}</ErrorLine>}
      <Button type="submit" size="lg" disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
