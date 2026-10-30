import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { setModules } from "@/api/host-actions";
import { useHostAction } from "@/hooks/useHostAction";
import { isLanguage } from "@/i18n/language";
import { switchActivity } from "@/lib/host/switch-activity";
import { defaultPicks } from "@/modules/defaultPicks";
import { isModuleId, type ModuleId } from "@/modules/registry";
import { isNicheId } from "@/niches";

/**
 * Switches activities on and off for the panel. `error` is a refused switch;
 * `notice` says an activity is on but its ready-made list couldn't be added.
 */
export function useActivitySwitch(event: EventRow, hostKey: string) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction();
  const [notice, setNotice] = useState<string>();

  async function toggle(id: ModuleId, on: boolean) {
    setNotice(undefined);
    const { niche, language } = event;
    const result = await run(() =>
      switchActivity({
        enabled: event.enabled_modules.filter(isModuleId),
        id,
        on,
        send: (modules) =>
          setModules({ code: event.code, key: hostKey, modules }),
        pick: async () =>
          isNicheId(niche) && isLanguage(language)
            ? defaultPicks[id]({
                eventId: event.id,
                code: event.code,
                key: hostKey,
                niche,
                language,
              })
            : { ok: false },
      }),
    );
    if (result.ok && result.pickFailed) {
      setNotice(
        t("hostPanel.activity.pickFailed", { name: t(`modules.${id}.name`) }),
      );
    }
  }

  return { busy, error, notice, toggle };
}
