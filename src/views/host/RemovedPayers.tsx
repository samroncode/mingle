import { useTranslation } from "react-i18next";
import { formatKr } from "@/lib/costs/shares";
import type { RemovedPayer } from "@/lib/schemas/bill";

/**
 * A note for each removed guest who had paid before they were removed. The
 * money isn't returned by Mingle: the host pays it back in Swish.
 */
export function RemovedPayers({ payers }: { payers: RemovedPayer[] }) {
  const { t } = useTranslation();
  if (payers.length === 0) return null;
  return (
    <ul className="space-y-2" data-testid="removed-payers">
      {payers.map((payer) => {
        const name = payer.name ?? "";
        return (
          <li
            key={payer.userId}
            className="rounded-md border-[length:var(--border-thin)] border-edge p-3 text-base text-on-paper"
          >
            {payer.paidKr === null
              ? t("hostPanel.costs.removedSaidPaid", { name })
              : t("hostPanel.costs.removedPaid", {
                  name,
                  amount: formatKr(payer.paidKr),
                })}
          </li>
        );
      })}
    </ul>
  );
}
