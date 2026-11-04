import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { QrCode } from "@/components/QrCode";
import { anyLineHasTime } from "@/lib/schedule";
import { wifiQrText } from "@/lib/tv/wifi-qr";
import type { Part } from "./parts";

type Of<K extends Part["kind"]> = Extract<Part, { kind: K }>;

/** A rotating part under the welcome: a brass heading over a thin line. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="fun-pop flex flex-col gap-(--space-4) border-t-[length:var(--border-thin)] border-line pt-(--space-5)"
    >
      <h2 className="font-display text-3xl font-extrabold text-champagne-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function MenuPart({ lines }: Of<"menu">) {
  const { t } = useTranslation();
  return (
    <Panel title={t("tv.menu")}>
      <ul className="columns-2 gap-(--space-7) space-y-2 font-display text-4xl font-bold">
        {lines.map((line, index) => (
          <li key={index} className="break-inside-avoid">
            {line}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function SchedulePart({ items }: Of<"schedule">) {
  const { t } = useTranslation();
  const hasTimes = anyLineHasTime(items);
  return (
    <Panel title={t("tv.schedule")}>
      <ul className="grid grid-cols-2 gap-x-(--space-7) gap-y-3 font-display text-4xl font-bold">
        {items.map((item, index) => (
          <li key={index} className="flex items-baseline gap-5">
            {hasTimes ? (
              item.time ? (
                <span className="font-display font-extrabold text-champagne-text">
                  {item.time}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="my-auto size-3 shrink-0 rounded-full bg-champagne"
                />
              )
            ) : null}
            <span className="font-body font-medium">{item.title}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function WinnersPart({ winners }: Of<"winners">) {
  const { t } = useTranslation();
  return (
    <Panel title={t("tv.winners")}>
      <ul
        data-testid="winners"
        className="grid w-full grid-cols-2 gap-(--space-4)"
      >
        {winners.map((winner, index) => (
          <li
            key={index}
            className="rounded-lg border-[length:var(--border-thin)] border-edge bg-champagne px-(--space-5) py-(--space-4) text-on-bright"
          >
            <p className="font-body text-2xl font-medium">{winner.title}</p>
            <p className="truncate font-display text-4xl font-extrabold">
              {winner.name}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function WifiPart({ ssid, password }: Of<"wifi">) {
  const { t } = useTranslation();
  return (
    <Panel title={t("tv.wifi.title")}>
      <div className="flex items-center gap-(--space-7)">
        <QrCode
          value={wifiQrText({ ssid, password })}
          label={t("tv.wifi.qrLabel")}
          size={200}
        />
        <dl className="font-display text-5xl">
          <dt className="font-body text-2xl text-ink-muted">
            {t("tv.wifi.network")}
          </dt>
          <dd data-testid="wifi-ssid" className="font-extrabold">
            {ssid}
          </dd>
          {password !== "" && (
            <>
              <dt className="mt-4 font-body text-2xl text-ink-muted">
                {t("tv.wifi.password")}
              </dt>
              <dd
                data-testid="wifi-password"
                className="font-extrabold tracking-wider text-champagne-text"
              >
                {password}
              </dd>
            </>
          )}
        </dl>
      </div>
    </Panel>
  );
}

export function MusicPart({ url }: Of<"music">) {
  const { t } = useTranslation();
  return (
    <Panel title={t("tv.music.title")}>
      <div className="flex items-center gap-(--space-7)">
        <QrCode value={url} label={t("tv.music.qrLabel")} size={200} />
        <p className="font-body text-4xl">{t("tv.music.text")}</p>
      </div>
    </Panel>
  );
}
