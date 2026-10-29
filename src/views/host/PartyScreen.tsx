import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { updatePartyContent } from "@/api/host-actions";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";
import { partyToForm, savePartyEdit } from "@/lib/host/party-edit";
import { readParty } from "@/lib/party";
import type { Party } from "@/lib/schemas/party";
import type { PartyField, PartyForm } from "@/lib/wizard/state";
import {
  MenuStep,
  ScheduleStep,
  WelcomeStep,
  WifiStep,
} from "@/views/create/party-steps";

interface PartyScreenProps {
  event: EventRow;
  hostKey: string;
}

function Part({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-md bg-surface-sunken p-3">
      <dt className="font-display text-sm font-bold text-ink-muted">{title}</dt>
      <dd className="whitespace-pre-line text-base text-ink">{children}</dd>
    </div>
  );
}

/** What the TV's party screen holds now. */
function PartyView({ party }: { party: Party }) {
  const { t } = useTranslation();
  const none = t("hostPanel.party.none");
  return (
    <dl className="space-y-2">
      <Part title={t("wizard.steps.welcome")}>{party.welcome ?? none}</Part>
      <Part title={t("wizard.steps.menu")}>
        {party.menu?.join("\n") ?? none}
      </Part>
      <Part title={t("wizard.steps.schedule")}>
        {party.schedule?.map((l) => `${l.time} ${l.title}`).join("\n") ?? none}
      </Part>
      <Part title={t("wizard.wifi.ssid")}>{party.wifi?.ssid ?? none}</Part>
      <Part title={t("wizard.music.label")}>{party.musicUrl ?? none}</Part>
    </dl>
  );
}

function PartyEditor({
  event,
  hostKey,
  onDone,
}: PartyScreenProps & { onDone: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PartyForm>(() =>
    partyToForm(readParty(event.party)),
  );
  const [invalid, setInvalid] = useState<PartyField[]>([]);
  const { busy, error, run } = useHostAction();
  const change = (part: Partial<PartyForm>) =>
    setForm((current) => ({ ...current, ...part }));
  const only = (...fields: PartyField[]) =>
    invalid.filter((field) => fields.includes(field));

  async function save() {
    const result = await run(() =>
      savePartyEdit(
        form,
        { code: event.code, key: hostKey },
        updatePartyContent,
      ),
    );
    if (result.ok) return onDone();
    setInvalid("invalid" in result ? result.invalid : []);
  }

  return (
    <div className="space-y-4">
      <WelcomeStep
        value={form.welcome}
        invalid={only("welcome")}
        onChange={(welcome) => change({ welcome })}
      />
      <MenuStep
        menu={form.menu}
        invalid={only("menu")}
        onChange={(menu) => change({ menu })}
      />
      <ScheduleStep
        schedule={form.schedule}
        invalid={only("schedule")}
        onChange={(schedule) => change({ schedule })}
      />
      <WifiStep
        party={form}
        invalid={only("wifi", "musicUrl")}
        onWifiChange={(wifiSsid, wifiPassword) =>
          change({ wifiSsid, wifiPassword })
        }
        onMusicChange={(musicUrl) => change({ musicUrl })}
      />
      {error && (
        <p role="alert" className="text-sm font-bold text-danger-text">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button size="lg" disabled={busy} onClick={() => void save()}>
          {t("hostPanel.party.save")}
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={onDone}>
          {t("hostPanel.party.cancel")}
        </Button>
      </div>
    </div>
  );
}

/** The party screen section: what the TV holds, with Edit. */
export function PartyScreen(props: PartyScreenProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  return (
    <section
      data-testid="party-screen"
      className="space-y-3 rounded-lg border-[length:var(--border-chunky)] border-edge bg-surface p-4 shadow-pop-md"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">
          {t("hostPanel.partyScreen")}
        </h2>
        {!editing && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditing(true)}
          >
            {t("hostPanel.party.edit")}
          </Button>
        )}
      </div>
      {editing ? (
        <PartyEditor {...props} onDone={() => setEditing(false)} />
      ) : (
        <PartyView party={readParty(props.event.party)} />
      )}
    </section>
  );
}
