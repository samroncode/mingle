import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateCosts } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHostAction } from "@/hooks/useHostAction";
import {
  hasErrors,
  newPurchaseForm,
  parseCostsForm,
  type CostsForm,
  type CostsFormErrors,
  type PurchaseForm,
} from "@/lib/costs/costs-form";
import type { ListedGuest } from "@/lib/host/guest-list";
import { costsLimits } from "@/lib/schemas/costs";

interface CostsEditorProps {
  code: string;
  hostKey: string;
  guests: ListedGuest[];
  initial: CostsForm;
  /** Called after a successful save. */
  onDone: () => void;
  onCancel: () => void;
}

function Field({
  label,
  invalid,
  hint,
  children,
}: {
  label: string;
  invalid?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <label className="block space-y-1">
      <span className="font-display text-sm font-bold">{label}</span>
      {children}
      {hint && (
        <span className="block text-sm text-on-paper-muted">{hint}</span>
      )}
      {invalid && <ErrorLine>{t("hostPanel.costs.invalid")}</ErrorLine>}
    </label>
  );
}

function PurchaseEditor({
  purchase,
  guests,
  errors,
  onChange,
  onRemove,
}: {
  purchase: PurchaseForm;
  guests: ListedGuest[];
  errors?: CostsFormErrors["purchases"][number];
  onChange: (part: Partial<PurchaseForm>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const toggle = (userId: string) =>
    onChange({
      sharers: purchase.sharers.includes(userId)
        ? purchase.sharers.filter((id) => id !== userId)
        : [...purchase.sharers, userId],
    });
  return (
    <li className="space-y-3 rounded-md border-[length:var(--border-thin)] border-edge p-3">
      <Field label={t("hostPanel.costs.purchaseName")} invalid={errors?.name}>
        <Input
          value={purchase.name}
          maxLength={costsLimits.purchaseName}
          aria-invalid={errors?.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>
      <Field label={t("hostPanel.costs.price")} invalid={errors?.price}>
        <Input
          inputMode="numeric"
          value={purchase.price}
          aria-invalid={errors?.price}
          onChange={(event) => onChange({ price: event.target.value })}
        />
      </Field>
      <fieldset className="space-y-1">
        <legend className="font-display text-sm font-bold">
          {t("hostPanel.costs.sharedBy")}
        </legend>
        {guests.map((guest) => (
          <label
            key={guest.userId}
            className="flex min-h-12 items-center gap-3 text-base"
          >
            <input
              type="checkbox"
              className="size-6 accent-primary"
              checked={purchase.sharers.includes(guest.userId)}
              onChange={() => toggle(guest.userId)}
            />
            {guest.name}
          </label>
        ))}
        {guests.length === 0 && (
          <p className="text-sm text-on-paper-muted">
            {t("hostPanel.costs.noGuests")}
          </p>
        )}
        {errors?.sharers && (
          <ErrorLine>{t("hostPanel.costs.noSharer")}</ErrorLine>
        )}
      </fieldset>
      <Button size="sm" variant="outline" onClick={onRemove}>
        {t("hostPanel.costs.removePurchase")}
      </Button>
    </li>
  );
}

/** The payee, the Swish number and the purchases, saved together. */
export function CostsEditor({
  code,
  hostKey,
  guests,
  initial,
  onDone,
  onCancel,
}: CostsEditorProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<CostsFormErrors>();
  const { busy, error, run } = useHostAction();
  const guestIds = guests.map((guest) => guest.userId);

  const change = (part: Partial<CostsForm>) =>
    setForm((current) => ({ ...current, ...part }));
  const changePurchase = (key: string, part: Partial<PurchaseForm>) =>
    change({
      purchases: form.purchases.map((p) =>
        p.key === key ? { ...p, ...part } : p,
      ),
    });

  async function save() {
    const parsed = parseCostsForm(form);
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors(undefined);
    const result = await run(() =>
      updateCosts({ code, key: hostKey, costs: parsed.costs }),
    );
    if (result.ok) onDone();
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field
        label={t("hostPanel.costs.payee")}
        hint={t("hostPanel.costs.payeeHint")}
        invalid={errors?.payeeName}
      >
        <Input
          value={form.payeeName}
          maxLength={costsLimits.payeeName}
          aria-invalid={errors?.payeeName}
          onChange={(event) => change({ payeeName: event.target.value })}
        />
      </Field>
      <Field
        label={t("hostPanel.costs.swish")}
        hint={t("hostPanel.costs.swishHint")}
        invalid={errors?.swishNumber}
      >
        <Input
          type="tel"
          inputMode="tel"
          value={form.swishNumber}
          aria-invalid={errors?.swishNumber}
          onChange={(event) => change({ swishNumber: event.target.value })}
        />
      </Field>
      <h3 className="font-display text-lg font-bold">
        {t("hostPanel.costs.purchases")}
      </h3>
      <ul className="space-y-3">
        {form.purchases.map((purchase, index) => (
          <PurchaseEditor
            key={purchase.key}
            purchase={purchase}
            guests={guests}
            errors={errors?.purchases[index]}
            onChange={(part) => changePurchase(purchase.key, part)}
            onRemove={() =>
              change({
                purchases: form.purchases.filter((p) => p.key !== purchase.key),
              })
            }
          />
        ))}
      </ul>
      {form.purchases.length < costsLimits.purchases && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            change({
              purchases: [...form.purchases, newPurchaseForm(guestIds)],
            })
          }
        >
          {t("hostPanel.costs.addPurchase")}
        </Button>
      )}
      {errors && hasErrors(errors) && (
        <ErrorLine>{t("hostPanel.costs.checkFields")}</ErrorLine>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {t("hostPanel.costs.save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          {t("hostPanel.costs.cancel")}
        </Button>
      </div>
    </form>
  );
}
