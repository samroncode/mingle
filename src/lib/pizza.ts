/** The pizzeria's menu page, shown on /pizza. Change it here. */
export const PIZZA_MENU_URL = "https://www.pizzeriamilan.nu/";

export interface PizzaLine {
  pizza: string;
  done: boolean;
}

export interface PizzaTotal {
  /** The pizza as first written. */
  pizza: string;
  count: number;
}

/**
 * Counts the orders per pizza for the shopping list, most ordered first.
 * "Capricciosa " and "capricciosa" are the same pizza. Orders already marked
 * as ordered are left out.
 */
export function summarizeOrders(orders: readonly PizzaLine[]): PizzaTotal[] {
  const totals = new Map<string, PizzaTotal>();
  for (const order of orders) {
    if (order.done) continue;
    const label = order.pizza.trim();
    const key = label.toLocaleLowerCase();
    const existing = totals.get(key);
    if (existing) existing.count += 1;
    else totals.set(key, { pizza: label, count: 1 });
  }
  return [...totals.values()].sort(
    (a, b) => b.count - a.count || a.pizza.localeCompare(b.pizza),
  );
}
