import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { cn } from "cn";

interface LogoProps {
  className?: string;
}

/**
 * The wordmark: "mingle" in brass (champagne) display type, its "i" dot a tilted
 * rust (coral) square.
 * Text plus a positioned dot, so it follows the theme and needs no image file.
 * Like on most sites, it is a link to the start page wherever it shows.
 */
export function Logo({ className }: LogoProps) {
  const { t } = useTranslation();
  return (
    <Link to="/" className="inline-flex rounded-sm">
      <span
        role="img"
        aria-label={t("app.name")}
        className={cn(
          "inline-flex items-baseline font-display text-3xl leading-none font-extrabold tracking-tight text-champagne-text",
          className,
        )}
      >
        <span aria-hidden="true">m</span>
        <span aria-hidden="true" className="relative">
          <span>ı</span>
          <span className="absolute top-[0.02em] left-1/2 size-[0.2em] -translate-x-1/2 rotate-12 rounded-[0.04em] border border-edge bg-coral" />
        </span>
        <span aria-hidden="true">ngle</span>
      </span>
    </Link>
  );
}
