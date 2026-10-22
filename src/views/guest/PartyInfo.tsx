import { useTranslation } from "react-i18next";
import { CopyButton } from "@/components/CopyButton";
import type { Party } from "@/lib/schemas/party";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** The evening's info for a guest: only the parts the host filled in. */
export function PartyInfo({ party }: { party: Party }) {
  const { t } = useTranslation();
  const { welcome, menu, schedule, wifi, musicUrl } = party;
  return (
    <div className="space-y-4">
      {welcome ? <p className="whitespace-pre-line">{welcome}</p> : null}
      {menu?.length ? (
        <Section title={t("guest.party.menu")}>
          <ul className="list-disc pl-5">
            {menu.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {schedule?.length ? (
        <Section title={t("guest.party.schedule")}>
          <ul>
            {schedule.map((item, i) => (
              <li key={i}>
                <span className="font-medium">{item.time}</span> {item.title}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {wifi ? (
        <Section title={t("guest.party.wifi")}>
          <p>{wifi.ssid}</p>
          {wifi.password ? (
            <div className="flex items-center gap-2">
              <span>{wifi.password}</span>
              <CopyButton
                text={wifi.password}
                label={t("guest.party.copyPassword")}
              />
            </div>
          ) : (
            <p className="text-muted-foreground">
              {t("guest.party.openNetwork")}
            </p>
          )}
        </Section>
      ) : null}
      {musicUrl ? (
        <a
          href={musicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md border px-4 py-2 font-medium"
        >
          {t("guest.party.music")}
        </a>
      ) : null}
    </div>
  );
}
