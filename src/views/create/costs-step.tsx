import { Plus, Trash2 } from "lucide-react";
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
  const nameInvalid = Boolean(purchase.name) && errors.name;
  const priceInvalid = Boolean(purchase.price) && errors.price;
  return (
    <li className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Input
          value={purchase.name}
          maxLength={costsLimits.purchaseName}
          aria-label={t("wizard.costs.purchaseName", { n: index + 1 })}
          aria-invalid={nameInvalid}
          onChange={(event) => change({ name: event.target.value })}
        />
        <div className="relative w-28 shrink-0">
          <Input
            inputMode="numeric"
            className="pr-9 text-right"
            value={purchase.price}
            aria-label={t("wizard.costs.price", { n: index + 1 })}
            aria-invalid={priceInvalid}
            onChange={(event) => change({ price: event.target.value })}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted"
          >
            {t("wizard.costs.priceUnit")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("wizard.costs.removePurchase", { n: index + 1 })}
          onClick={() =>
            dispatch({ type: "remove_purchase", key: purchase.key })
          }
        >
          <Trash2 />
        </Button>
      </div>
      {(nameInvalid || priceInvalid) && (
        <ErrorLine>{t("wizard.costs.invalid")}</ErrorLine>
      )}
    </li>
  );
}

/** Column titles above the first purchase; the inputs carry their own names. */
function PurchaseHeader() {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden="true"
      className="flex gap-1 text-sm font-bold text-ink-muted"
    >
      <span className="min-w-0 flex-1 px-3">
        {t("wizard.costs.columnName")}
      </span>
      <span className="w-28 shrink-0 px-3 text-right">
        {t("wizard.costs.columnPrice")}
      </span>
      <span className="w-12 shrink-0" />
    </div>
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
    <div className="space-y-8">
      <p>{t("wizard.costs.intro")}</p>
      <section className="space-y-4">
        <Field
          label={t("wizard.costs.payee")}
          hint={t("wizard.costs.payeeHint")}
          invalid={Boolean(costs.payeeName) && errors?.payeeName}
        >
          <Input
            value={costs.payeeName}
            maxLength={costsLimits.payeeName}
            placeholder={t("wizard.costs.payeePlaceholder")}
            aria-invalid={Boolean(costs.payeeName) && errors?.payeeName}
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
            aria-invalid={Boolean(costs.swishNumber) && errors?.swishNumber}
            onChange={(event) =>
              dispatch({ type: "set_swish", swishNumber: event.target.value })
            }
          />
        </Field>
      </section>
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold">
            {t("wizard.costs.purchases")}
          </h2>
          <p className="text-sm text-ink-muted">
            {t("wizard.costs.purchasesHint")}
          </p>
        </div>
        {costs.purchases.length > 0 && <PurchaseHeader />}
        <ul className="space-y-2">
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
            variant="link"
            size="lg"
            onClick={() => dispatch({ type: "add_purchase" })}
          >
            <Plus aria-hidden="true" />
            {t("wizard.costs.addPurchase")}
          </Button>
        )}
      </section>
    </div>
  );
}
