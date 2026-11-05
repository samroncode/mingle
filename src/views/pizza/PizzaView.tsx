import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { submitPizzaOrder, type PizzaOrderErrorCode } from "@/api/pizza";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PIZZA_MENU_URL } from "@/lib/pizza";

export function PizzaView() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [pizza, setPizza] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PizzaOrderErrorCode | null>(null);
  const [sent, setSent] = useState(false);
  const ready = name.trim() && pizza.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const result = await submitPizzaOrder({
      name,
      pizza,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(result.error);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-extrabold text-ink">
          {t("views.pizza.thanksTitle")}
        </h1>
        <p className="text-ink-muted">{t("views.pizza.thanksText")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-extrabold text-ink">
        {t("views.pizza.title")}
      </h1>
      <p>
        <a
          href={PIZZA_MENU_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline"
        >
          {t("views.pizza.menuLink")}
        </a>
      </p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("views.pizza.name")}
        aria-label={t("views.pizza.name")}
        maxLength={40}
        autoComplete="off"
      />
      <Input
        value={pizza}
        onChange={(e) => setPizza(e.target.value)}
        placeholder={t("views.pizza.pizza")}
        aria-label={t("views.pizza.pizza")}
        maxLength={60}
        autoComplete="off"
      />
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("views.pizza.note")}
        aria-label={t("views.pizza.note")}
        maxLength={100}
        autoComplete="off"
      />
      {error && <ErrorLine>{t(`views.pizza.errors.${error}`)}</ErrorLine>}
      <Button type="submit" size="lg" disabled={!ready || busy}>
        {t("views.pizza.send")}
      </Button>
    </form>
  );
}
