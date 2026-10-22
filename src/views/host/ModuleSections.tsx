import { useEventState } from "@/hooks/useEventState";
import { moduleDefinitions } from "@/modules/definitions";
import { moduleIds } from "@/modules/registry";

/** The control panel section of each switched-on activity that has one. */
export function ModuleSections({ eventId }: { eventId: string }) {
  const { event, members } = useEventState(eventId);
  if (!event) return null;

  return (
    <>
      {moduleIds
        .filter((id) => event.enabled_modules.includes(id))
        .map((id) => {
          const definition = moduleDefinitions[id];
          return definition ? (
            <definition.Host key={id} event={event} members={members} />
          ) : null;
        })}
    </>
  );
}
