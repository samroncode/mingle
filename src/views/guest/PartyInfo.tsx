import { useTranslation } from "react-i18next";
import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import type { NoticeView } from "@/api/notices";
import type { Party } from "@/lib/schemas/party";
import { NoticeList } from "./NoticeList";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <Card>
      <CardTitle className="text-2xl">{title}</CardTitle>
      {children}
    </Card>
  );
}

/** The evening's info for a guest: only the parts the host filled in. */
export function PartyInfo({
  party,
  notices = [],
}: {
  party: Party;
  notices?: readonly NoticeView[];
}) {
  const { t } = useTranslation();
  const { welcome, menu, schedule, wifi, musicUrl } = party;
  return (
    <div className="space-y-5">
      {welcome ? (
        <p className="text-xl leading-snug whitespace-pre-line">{welcome}</p>
      ) : null}
      <NoticeList notices={notices} />
      {menu?.length ? (
        <Section title={t("guest.party.menu")}>
          <ul className="list-disc space-y-1 pl-5 text-lg">
            {menu.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {schedule?.length ? (
        <Section title={t("guest.party.schedule")}>
          <ul className="space-y-3">
            {schedule.map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-lg">
                <Sticker
                  color="champagne"
                  lean={i % 2 === 0 ? "left" : "right"}
                >
                  {item.time}
                </Sticker>
                <span>{item.title}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {wifi ? (
        <Section title={t("guest.party.wifi")}>
          <p className="font-display text-3xl leading-none font-extrabold break-all">
            {wifi.ssid}
          </p>
          {wifi.password ? (
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-xl font-bold break-all">
                {wifi.password}
              </span>
              <CopyButton
                text={wifi.password}
                label={t("guest.party.copyPassword")}
              />
            </div>
          ) : (
            <p className="text-on-paper-muted">
              {t("guest.party.openNetwork")}
            </p>
          )}
        </Section>
      ) : null}
      {musicUrl ? (
        <Button asChild size="lg" variant="accent">
          <a href={musicUrl} target="_blank" rel="noopener noreferrer">
            {t("guest.party.music")}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
