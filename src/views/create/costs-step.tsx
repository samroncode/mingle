import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { costsLimits } from "@/lib/schemas/costs";
import {
  parseCosts,
  type CostPurchaseDraft,
  type CostsAction,
  type CostsDraft,
} from "@/lib/wizard/costs";

function Field({
  label,
  hint,
  invalid,
  children,
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <label className="block space-y-1.5">
      <span className="font-display text-base font-bold">{label}</span>
      {children}
      {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
      {invalid && <ErrorLine>{t("wizard.costs.invalid")}</ErrorLine>}
    </label>
  );
}

function PurchaseRow({
  purchase,
  index,
  errors,
  dispatch,
}: {
  purchase: CostPurchaseDraft;
  index: number;
  errors: { name: boolean; price: boolean };
  dispatch: (action: CostsAction) => void;
}) {
  const { t } = useTranslation();
  const change = (part: Partial<CostPurchaseDraft>) =>
    dispatch({ type: "change_purchase", key: purchase.key, part });
  return (
    <li className="space-y-3 rounded-md border-[length:var(--border-thin)] border-edge p-3">
      <Field
        label={t("wizard.costs.purchaseName", { n: index + 1 })}
        invalid={Boolean(purchase.name) && errors.name}
      >
        <Input
          value={purchase.name}
          maxLength={costsLimits.purchaseName}
          aria-invalid={Boolean(purchase.name) && errors.name}
          onChange={(event) => change({ name: event.target.value })}
        />
      </Field>
      <Field
        label={t("wizard.costs.price", { n: index + 1 })}
        invalid={Boolean(purchase.price) && errors.price}
      >
        <Input
          inputMode="numeric"
          value={purchase.price}
          aria-invalid={Boolean(purchase.price) && errors.price}
          onChange={(event) => change({ price: event.target.value })}
        />
      </Field>
      <Button
        variant="outline"
        size="sm"
        onClick={() => dispatch({ type: "remove_purchase", key: purchase.key })}
      >
        <Trash2 aria-hidden="true" />
        {t("wizard.costs.removePurchase", { n: index + 1 })}
      </Button>
    </li>
  );
}

/**
 * Who guests pay, and the purchases so far. Errors show only for what has
 * been typed; Next stays blocked until the name and number are right.
 */
export function CostsStep({
  costs,
  dispatch,
}: {
  costs: CostsDraft;
  dispatch: (action: CostsAction) => void;
}) {
  const { t } = useTranslation();
  const result = parseCosts(costs);
  const errors = result.ok ? undefined : result.errors;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t("wizard.costs.intro")}</p>
      <Field
        label={t("wizard.costs.payee")}
        hint={t("wizard.costs.payeeHint")}
        invalid={Boolean(costs.payeeName) && errors?.payeeName}
      >
        <Input
          value={costs.payeeName}
          maxLength={costsLimits.payeeName}
          onChange={(event) =>
            dispatch({ type: "set_payee", payeeName: event.target.value })
          }
        />
      </Field>
      <Field
        label={t("wizard.costs.swish")}
        hint={t("wizard.costs.swishHint")}
        invalid={Boolean(costs.swishNumber) && errors?.swishNumber}
      >
        <Input
          type="tel"
          inputMode="tel"
          value={costs.swishNumber}
          onChange={(event) =>
            dispatch({ type: "set_swish", swishNumber: event.target.value })
          }
        />
      </Field>
      <h2 className="font-display text-lg font-bold">
        {t("wizard.costs.purchases")}
      </h2>
      <p className="text-sm text-ink-muted">
        {t("wizard.costs.purchasesHint")}
      </p>
      <ul className="space-y-3">
        {costs.purchases.map((purchase, index) => (
          <PurchaseRow
            key={purchase.key}
            purchase={purchase}
            index={index}
            errors={errors?.purchases[index] ?? { name: false, price: false }}
            dispatch={dispatch}
          />
        ))}
      </ul>
      {costs.purchases.length < costsLimits.purchases && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: "add_purchase" })}
        >
          {t("wizard.costs.addPurchase")}
        </Button>
      )}
      {errors && (
        <p className="text-sm text-ink-muted">{t("wizard.costs.fillIn")}</p>
      )}
    </div>
  );
}
