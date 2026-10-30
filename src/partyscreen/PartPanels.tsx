import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { QrCode } from "@/components/QrCode";
import { wifiQrText } from "@/lib/tv/wifi-qr";
import { NAME_MAX_CH, NAMES_AREA, nameSizeRem } from "./name-size";
import type { Part } from "./parts";

type Of<K extends Part["kind"]> = Extract<Part, { kind: K }>;

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex h-full flex-col items-center justify-center gap-(--space-6) rounded-xl border-[length:var(--border-thin)] border-edge bg-forest p-(--space-7) text-center text-on-forest"
    >
      <h2 className="font-display text-6xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export function MenuPart({ lines }: Of<"menu">) {
  const { t } = useTranslation();
  return (
    <Panel title={t("tv.menu")}>
      <ul className="space-y-3 font-display text-5xl font-bold">
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    </Panel>
  );
}

export function SchedulePart({ items }: Of<"schedule">) {
  const { t } = useTranslation();
  return (
    <Panel title={t("tv.schedule")}>
      <ul className="space-y-3 font-display text-5xl font-bold">
        {items.map((item, index) => (
          <li key={index} className="flex gap-6">
            <span className="font-display font-extrabold text-champagne">
              {item.time}
            </span>
            <span className="font-body font-medium">{item.title}</span>
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
      <QrCode
        value={wifiQrText({ ssid, password })}
        label={t("tv.wifi.qrLabel")}
        size={320}
      />
      <dl className="font-display text-5xl">
        <dt className="font-body text-2xl text-on-forest/80">
          {t("tv.wifi.network")}
        </dt>
        <dd data-testid="wifi-ssid" className="font-extrabold">
          {ssid}
        </dd>
        {password !== "" && (
          <>
            <dt className="mt-4 font-body text-2xl text-on-forest/80">
              {t("tv.wifi.password")}
            </dt>
            <dd
              data-testid="wifi-password"
              className="font-extrabold tracking-wider text-champagne"
            >
              {password}
            </dd>
          </>
        )}
      </dl>
    </Panel>
  );
}

export function MusicPart({ url }: Of<"music">) {
  const { t } = useTranslation();
  return (
    <Panel title={t("tv.music.title")}>
      <QrCode value={url} label={t("tv.music.qrLabel")} size={320} />
      <p className="font-body text-3xl">{t("tv.music.text")}</p>
    </Panel>
  );
}

export function GuestsPart({ names }: Of<"guests">) {
  const { t } = useTranslation();
  return (
    <Panel title={t("tv.guests")}>
      <ul
        data-testid="guest-names"
        className="flex flex-wrap content-start justify-center gap-x-8 gap-y-2 overflow-hidden font-display font-bold"
        style={{
          fontSize: `${nameSizeRem(names)}rem`,
          maxWidth: `${NAMES_AREA.width}rem`,
          maxHeight: `${NAMES_AREA.height}rem`,
        }}
      >
        {names.map((name, index) => (
          <li
            key={index}
            className="truncate whitespace-nowrap"
            style={{ maxWidth: `${NAME_MAX_CH}ch` }}
          >
            {name}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
