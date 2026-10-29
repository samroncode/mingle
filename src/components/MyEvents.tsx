import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hostLink } from "@/lib/links";
import { forgetMyEvent, loadMyEvents } from "@/lib/guest/my-events";

/** The events created on this device, each with a way back into its control panel. */
export function MyEvents() {
  const { t } = useTranslation();
  const [events, setEvents] = useState(() => loadMyEvents());

  if (events.length === 0) return null;

  function forget(code: string) {
    forgetMyEvent(code);
    setEvents(loadMyEvents());
  }

  return (
    <section aria-labelledby="my-events-title" className="space-y-3">
      <h2 id="my-events-title" className="font-display text-2xl font-extrabold">
        {t("myEvents.title")}
      </h2>
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.code}>
            <Card className="flex-row items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl font-extrabold tracking-widest">
                  {event.code}
                </p>
                <p className="text-sm text-on-paper-muted">
                  {t(`niches.${event.niche}.name`)}
                </p>
              </div>
              <Button asChild size="sm">
                <Link to={hostLink("", event.code, event.key)}>
                  {t("myEvents.open")}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-on-paper"
                aria-label={t("myEvents.forgetLabel", { code: event.code })}
                onClick={() => forget(event.code)}
              >
                {t("myEvents.forget")}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">{t("myEvents.hint")}</p>
    </section>
  );
}
