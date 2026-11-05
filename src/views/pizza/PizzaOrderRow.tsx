import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AdminPizzaOrder } from "@/api/pizza-admin";

interface PizzaOrderRowProps {
  order: AdminPizzaOrder;
  busy: boolean;
  onToggleDone: (order: AdminPizzaOrder) => void;
  onDelete: (order: AdminPizzaOrder) => void;
}

/** One order with its "ordered" toggle and a delete that asks first. */
export function PizzaOrderRow({
  order,
  busy,
  onToggleDone,
  onDelete,
}: PizzaOrderRowProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="space-y-2 py-3">
      <div className={order.done ? "text-ink-muted line-through" : ""}>
        <p className="font-bold">{order.pizza}</p>
        <p>{order.name}</p>
        {order.note && <p className="text-sm italic">{order.note}</p>}
      </div>
      {confirming ? (
        <div role="alertdialog" className="flex flex-wrap items-center gap-2">
          <p className="text-sm">
            {t("views.pizzaAdmin.deleteConfirm", { name: order.name })}
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => onDelete(order)}
          >
            {t("views.pizzaAdmin.delete")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            {t("views.pizzaAdmin.cancel")}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onToggleDone(order)}
          >
            {order.done
              ? t("views.pizzaAdmin.markNotOrdered")
              : t("views.pizzaAdmin.markOrdered")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {t("views.pizzaAdmin.delete")}
          </Button>
        </div>
      )}
    </li>
  );
}
