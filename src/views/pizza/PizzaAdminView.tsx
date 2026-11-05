import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearPizzaOrders,
  deletePizzaOrder,
  listPizzaOrders,
  setPizzaOrderDone,
  type AdminPizzaOrder,
  type PizzaAdminErrorCode,
} from "@/api/pizza-admin";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { readAdminKey } from "@/lib/host/admin-key";
import { summarizeOrders } from "@/lib/pizza";
import { PizzaOrderRow } from "./PizzaOrderRow";

type Result = { ok: true } | { ok: false; error: PizzaAdminErrorCode };

/** The owner's page for pizza orders. The key comes from the link's fragment. */
export function PizzaAdminView() {
  const { t } = useTranslation();
  const key = useMemo(() => readAdminKey(window.location.hash), []);
  const [orders, setOrders] = useState<AdminPizzaOrder[] | null>(null);
  const [error, setError] = useState<PizzaAdminErrorCode | null>(
    key ? null : "forbidden",
  );
  const [busy, setBusy] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const show = useCallback(
    (result: Awaited<ReturnType<typeof listPizzaOrders>>) => {
      if (result.ok) {
        setOrders(result.value);
        setError(null);
      } else {
        setError(result.error);
      }
    },
    [],
  );

  useEffect(() => {
    if (!key) return;
    let current = true;
    void listPizzaOrders(key).then((result) => {
      if (current) show(result);
    });
    return () => {
      current = false;
    };
  }, [key, show]);

  async function load() {
    if (!key) return;
    setBusy(true);
    show(await listPizzaOrders(key));
    setBusy(false);
  }

  async function act(run: (adminKey: string) => Promise<Result>) {
    if (!key) return;
    setBusy(true);
    const result = await run(key);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmingClear(false);
    await load();
  }

  if (!key || error === "forbidden") {
    return <ErrorLine>{t("views.pizzaAdmin.errors.forbidden")}</ErrorLine>;
  }

  const totals = summarizeOrders(orders ?? []);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-extrabold text-ink">
        {t("views.pizzaAdmin.title")}
      </h1>
      {error && <ErrorLine>{t(`views.pizzaAdmin.errors.${error}`)}</ErrorLine>}
      <Button variant="outline" disabled={busy} onClick={() => void load()}>
        {t("views.pizzaAdmin.refresh")}
      </Button>
      {orders && orders.length === 0 && (
        <p className="text-ink-muted">{t("views.pizzaAdmin.empty")}</p>
      )}
      {totals.length > 0 && (
        <Card>
          <CardTitle>{t("views.pizzaAdmin.toOrder")}</CardTitle>
          <ul>
            {totals.map((line) => (
              <li key={line.pizza.toLocaleLowerCase()}>
                {line.count} × {line.pizza}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {orders && orders.length > 0 && (
        <ul className="divide-y divide-edge">
          {orders.map((order) => (
            <PizzaOrderRow
              key={order.id}
              order={order}
              busy={busy}
              onToggleDone={(o) =>
                void act((k) => setPizzaOrderDone(k, o.id, !o.done))
              }
              onDelete={(o) => void act((k) => deletePizzaOrder(k, o.id))}
            />
          ))}
        </ul>
      )}
      {orders && orders.length > 0 && (
        <div className="space-y-2">
          {confirmingClear ? (
            <div role="alertdialog" className="flex flex-wrap gap-2">
              <p>{t("views.pizzaAdmin.clearConfirm")}</p>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void act((k) => clearPizzaOrders(k))}
              >
                {t("views.pizzaAdmin.clear")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmingClear(false)}
              >
                {t("views.pizzaAdmin.cancel")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmingClear(true)}>
              {t("views.pizzaAdmin.clear")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
