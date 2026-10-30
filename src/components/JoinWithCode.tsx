import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeJoinCode } from "@/lib/links";

export function JoinWithCode() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const code = normalizeJoinCode(value);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (code) void navigate(`/p/${code}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="font-display text-2xl leading-none font-extrabold text-ink">
        {t("views.landing.joinTitle")}
      </h2>
      <div className="flex flex-col gap-4">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("views.landing.joinPlaceholder")}
          aria-label={t("views.landing.joinPlaceholder")}
          className="font-display text-2xl font-bold tracking-widest uppercase"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" size="lg" disabled={!code}>
          {t("views.landing.join")}
        </Button>
      </div>
    </form>
  );
}
