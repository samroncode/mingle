// #14: a guest changes their own display name, and nothing else.
import { beforeEach, describe, expect, it } from "vitest";
import { expireEvent, seedCast, type Cast, type User } from "./helpers";

let cast: Cast;

beforeEach(async () => {
  cast = await seedCast();
});

/** Every member row of the event as the host sees it. */
async function membersAsHost() {
  const { data } = await cast.host.client
    .from("members")
    .select("event_id, user_id, role, display_name")
    .eq("event_id", cast.event.id)
    .order("user_id");
  return data;
}

async function rename(actor: User, target: User, displayName: string) {
  return actor.client
    .from("members")
    .update({ display_name: displayName })
    .eq("event_id", cast.event.id)
    .eq("user_id", target.id)
    .select("display_name");
}

describe("a guest renames themselves", () => {
  it("and the new name is what every member sees", async () => {
    const { data, error } = await rename(cast.guestA, cast.guestA, "Annika");

    expect(error).toBeNull();
    expect(data).toEqual([{ display_name: "Annika" }]);
    const { data: seen } = await cast.tv.client
      .from("members")
      .select("display_name")
      .eq("user_id", cast.guestA.id)
      .single();
    expect(seen?.display_name).toBe("Annika");
  });

  it("with the new name trimmed", async () => {
    const { data } = await rename(cast.guestA, cast.guestA, "  Annika  ");

    expect(data).toEqual([{ display_name: "Annika" }]);
  });

  it("to a different case of their own name", async () => {
    const { data } = await rename(cast.guestA, cast.guestA, "ANNA");

    expect(data).toEqual([{ display_name: "ANNA" }]);
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["31 characters", "x".repeat(31)],
  ])("but not to a name that is %s", async (_, name) => {
    const before = await membersAsHost();

    const { error } = await rename(cast.guestA, cast.guestA, name);

    expect(error?.code).toBe("23514");
    expect(await membersAsHost()).toEqual(before);
  });

  it("but not to another guest's name, ignoring case", async () => {
    const before = await membersAsHost();

    const { error } = await rename(cast.guestA, cast.guestA, "bertil");

    // The data layer maps this unique violation to `name_taken`.
    expect(error?.code).toBe("23505");
    expect(error?.message).toContain("members_guest_name_key");
    expect(await membersAsHost()).toEqual(before);
  });

  it.each([
    ["role", { role: "host" }],
    ["event", { event_id: "00000000-0000-0000-0000-000000000000" }],
    ["user", { user_id: "00000000-0000-0000-0000-000000000000" }],
  ])("but can't change their %s", async (_, change) => {
    const before = await membersAsHost();

    const { error } = await cast.guestA.client
      .from("members")
      .update(change)
      .eq("user_id", cast.guestA.id);

    expect(error).not.toBeNull();
    expect(await membersAsHost()).toEqual(before);
  });

  it("but not after the event has expired", async () => {
    await expireEvent(cast.event.id);

    const { data } = await rename(cast.guestA, cast.guestA, "Annika");

    expect(data).toEqual([]);
    const { data: row } = await cast.guestA.client
      .from("members")
      .select("display_name");
    expect(row).toEqual([]);
  });
});

describe("nobody renames anyone else", () => {
  it.each(["guestB", "tv", "host"] as const)(
    "a guest can't rename the %s",
    async (target) => {
      const before = await membersAsHost();

      const { data } = await rename(cast.guestA, cast[target], "Hacked");

      expect(data).toEqual([]);
      expect(await membersAsHost()).toEqual(before);
    },
  );

  it.each(["tv", "host"] as const)(
    "the %s can't give itself a display name",
    async (role) => {
      const before = await membersAsHost();

      const { data } = await rename(cast[role], cast[role], "Me");

      expect(data).toEqual([]);
      expect(await membersAsHost()).toEqual(before);
    },
  );

  it.each(["host", "tv"] as const)(
    "the %s can't rename a guest",
    async (role) => {
      const before = await membersAsHost();

      const { data } = await rename(cast[role], cast.guestA, "Renamed");

      expect(data).toEqual([]);
      expect(await membersAsHost()).toEqual(before);
    },
  );

  it.each(["nonMember", "otherHost"] as const)(
    "the %s can't rename any member",
    async (role) => {
      const before = await membersAsHost();

      const results = await Promise.all(
        [cast.guestA, cast.tv, cast.host].map((target) =>
          rename(cast[role], target, "Renamed"),
        ),
      );

      for (const { data } of results) expect(data).toEqual([]);
      expect(await membersAsHost()).toEqual(before);
    },
  );
});
