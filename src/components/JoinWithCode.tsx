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
    <form onSubmit={submit} className="space-y-2">
      <h2 className="text-lg font-semibold">{t("views.landing.joinTitle")}</h2>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("views.landing.joinPlaceholder")}
          aria-label={t("views.landing.joinPlaceholder")}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={!code}>
          {t("views.landing.join")}
        </Button>
      </div>
    </form>
  );
}
