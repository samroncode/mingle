import type { Page, Route } from "@playwright/test";
import {
  eventRow,
  fakeEventId,
  memberRow,
  type EventRow,
  type MemberRow,
} from "./fake-rows.ts";

export const supabase = "http://localhost:54399";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
};

/**
 * Answers a CORS preflight and returns true; false for any other request.
 * The page runs on another origin than the fake API, so every route needs it.
 */
function answerPreflight(route: Route): boolean {
  const request = route.request();
  if (request.method() !== "OPTIONS") return false;
  void route.fulfill({
    status: 204,
    headers: {
      ...cors,
      "access-control-allow-headers":
        request.headers()["access-control-request-headers"] ?? "*",
    },
  });
  return true;
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: { ...cors, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** An unsigned token: the client stores it and never verifies it. */
function fakeToken() {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: "none" })}.${encode({ sub: "u1", exp, role: "authenticated" })}.x`;
}

/**
 * Fakes Cloudflare's Turnstile script: the first `failures` checks fail, every
 * later one gives the token `fake-token`. The dev server runs with a site key
 * (see playwright.config.ts), so every sign-in goes through this.
 */
async function fakeTurnstile(page: Page, failures: number) {
  await page.addInitScript(`window.turnstileFailures = ${failures};`);
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.turnstile = {
        render(container, options) {
          if (window.turnstileFailures-- > 0) {
            setTimeout(options["error-callback"], 0);
          } else {
            setTimeout(() => options.callback("fake-token"), 0);
          }
          return "widget";
        },
        remove() {},
      };`,
    }),
  );
}

/**
 * Fakes anonymous sign-in, Turnstile and host-actions; returns the bodies
 * host-actions got. Each call takes the next answer; once they run out, it
 * fails with `internal_error`. `captchaFailures` makes that many CAPTCHA
 * checks fail before they pass.
 */
export async function fakeSupabase(
  page: Page,
  answers: Array<() => [number, unknown]>,
  { captchaFailures = 0 }: { captchaFailures?: number } = {},
) {
  await fakeTurnstile(page, captchaFailures);
  const bodies: unknown[] = [];
  await page.route(`${supabase}/auth/v1/**`, (route) => {
    if (answerPreflight(route)) return;
    const user = { id: "u1", aud: "authenticated", is_anonymous: true };
    return json(route, 200, {
      access_token: fakeToken(),
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "r",
      user,
    });
  });
  await page.route(`${supabase}/functions/v1/host-actions`, (route) => {
    if (answerPreflight(route)) return;
    bodies.push(route.request().postDataJSON());
    const answer = answers.shift();
    const [status, body] = answer
      ? answer()
      : [500, { error: "internal_error" }];
    return json(route, status, body);
  });
  return bodies;
}

type TvFakeOptions = {
  /** The `join_tv` answer; defaults to joining the event. */
  join?: { event_id: string | null; error: string | null };
  /** The event the snapshot read returns (members included); null for none. */
  snapshot: (EventRow & { members: MemberRow[] }) | null;
  /** The quiz the TV can read, for a snapshot with the quiz running. */
  quiz?: FakeQuiz;
};

/**
 * Fakes what the TV needs on top of `fakeSupabase`: the `join_tv` RPC, the
 * snapshot read and the realtime socket, whose subscription it confirms.
 * Returns the codes `join_tv` got.
 */
export async function fakeTv(page: Page, options: TvFakeOptions) {
  const codes: string[] = [];
  await page.route(`${supabase}/rest/v1/rpc/join_tv`, (route) => {
    if (answerPreflight(route)) return;
    codes.push((route.request().postDataJSON() as { code: string }).code);
    return json(route, 200, options.join ?? { event_id: "e1", error: null });
  });
  await page.route(
    /\/rest\/v1\/(quiz_questions|quiz_answers|rpc\/quiz_(progress|votes|scores))/,
    (route) => {
      if (answerPreflight(route)) return;
      if (!answerQuiz(route, options.quiz ?? { rows: [] })) {
        return json(route, 404, { error: "unexpected request" });
      }
    },
  );
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (answerPreflight(route)) return;
    if (!options.snapshot) {
      return json(route, 406, { code: "PGRST116", message: "no rows" });
    }
    return json(route, 200, options.snapshot);
  });
  await fakeRealtime(page);
  return codes;
}

/** Accepts the realtime socket and confirms every channel it is asked to join. */
export async function fakeRealtime(page: Page) {
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    ws.onMessage((raw) => {
      // Protocol 2.0.0 frames: [join_ref, ref, topic, event, payload].
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw)) as [
        string | null,
        string,
        string,
        string,
        { config?: { postgres_changes?: object[] } } | undefined,
      ];
      if (event === "heartbeat") {
        ws.send(
          JSON.stringify([
            null,
            ref,
            topic,
            "phx_reply",
            { status: "ok", response: {} },
          ]),
        );
      } else if (event === "phx_join") {
        const filters = payload?.config?.postgres_changes ?? [];
        const confirmed = filters.map((filter, id) => ({ ...filter, id }));
        ws.send(
          JSON.stringify([
            joinRef,
            ref,
            topic,
            "phx_reply",
            { status: "ok", response: { postgres_changes: confirmed } },
          ]),
        );
      }
    });
  });
}

/** Records the URL of every request the page makes, from now on. */
export function recordRequestUrls(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  return urls;
}

/** What the fake event world answers to a join: "ok", or the error code. */
export type JoinAnswer = string;

interface FakeEventOptions {
  code: string;
  /** Each join call takes the next answer; "ok" joins under the sent name. */
  joinAnswers?: JoinAnswer[];
  /** Start as a guest of the event, with this name. */
  joinedAs?: string;
  welcome?: string;
  /** The whole party content; wins over `welcome`. */
  party?: EventRow["party"];
}

/**
 * Fakes the reads and writes a guest's phone makes: the event lookup by code,
 * the join RPC, the snapshot, renaming, and the realtime socket (which
 * confirms the subscription and never sends changes). Pair it with
 * `fakeSupabase`, which fakes sign-in. Returns the names the page sent.
 */
export async function fakeEvent(page: Page, options: FakeEventOptions) {
  const answers = [...(options.joinAnswers ?? [])];
  const sent: string[] = [];
  let myName = options.joinedAs;

  const event = () =>
    eventRow({
      code: options.code,
      party:
        options.party ?? (options.welcome ? { welcome: options.welcome } : {}),
    });
  const me = () => memberRow({ display_name: myName ?? null });

  await page.route(`${supabase}/rest/v1/**`, async (route) => {
    if (answerPreflight(route)) return;
    const request = route.request();
    const url = request.url();
    if (url.includes("/rpc/join_event")) {
      const name = (request.postDataJSON() as { display_name: string })
        .display_name;
      sent.push(name);
      const answer = answers.shift() ?? "unknown";
      if (answer === "ok") myName = name;
      return json(
        route,
        200,
        answer === "ok"
          ? { event_id: fakeEventId, error: null }
          : { event_id: null, error: answer },
      );
    }
    if (url.includes("/rest/v1/members") && request.method() === "PATCH") {
      myName = (request.postDataJSON() as { display_name: string })
        .display_name;
      return json(route, 200, [{ display_name: myName }]);
    }
    if (url.includes("code=eq.")) {
      // maybeSingle reads an array of zero or one rows.
      if (!myName) return json(route, 200, []);
      return json(route, 200, [
        { id: fakeEventId, members: [{ user_id: "u1", role: "guest" }] },
      ]);
    }
    if (url.includes("id=eq.")) {
      return json(route, 200, [{ ...event(), members: myName ? [me()] : [] }]);
    }
    return json(route, 404, { error: "unexpected request" });
  });

  await fakeRealtime(page);
  return sent;
}

/** A quiz question as the host's read returns it, with its key embedded. */
export interface FakeQuizRow {
  id: string;
  position: number;
  text: string;
  options: string[];
  /** The right option, or null where the reader can't see the key yet. */
  correct: number | null;
  /** How many guests have answered; defaults to 0. */
  answerCount?: number;
  /** Revealed, so it counts as played. */
  played?: boolean;
}

/** The quiz a fake serves: the readable questions and the progress counts. */
export interface FakeQuiz {
  rows: FakeQuizRow[];
  /** Defaults to the number of rows. */
  total?: number;
  played?: number;
  /** The ids of the guests who have answered (the host reads them). */
  answeredBy?: string[];
  /** Votes per option once the question is revealed (A to D). */
  votes?: number[];
  /** What quiz_scores gives the viewer: name, points and place, best first. */
  scores?: Array<{ name: string; score: number; place: number }>;
}

/**
 * Answers the quiz reads (`quiz_questions` with keys, `quiz_progress`) and
 * returns true; false for any other request.
 */
function answerQuiz(route: Route, quiz: FakeQuiz): boolean {
  const url = route.request().url();
  if (url.includes("/rest/v1/rpc/quiz_votes")) {
    void json(
      route,
      200,
      (quiz.votes ?? []).map((votes, option) => ({ option, votes })),
    );
    return true;
  }
  if (url.includes("/rest/v1/rpc/quiz_scores")) {
    void json(
      route,
      200,
      (quiz.scores ?? []).map(({ name, score, place }, i) => ({
        user_id: `g${i}`,
        display_name: name,
        score,
        place,
      })),
    );
    return true;
  }
  if (url.includes("/rest/v1/quiz_answers")) {
    void json(
      route,
      200,
      (quiz.answeredBy ?? []).map((user_id) => ({ user_id })),
    );
    return true;
  }
  if (url.includes("/rest/v1/rpc/quiz_progress")) {
    void json(route, 200, [
      { total: quiz.total ?? quiz.rows.length, played: quiz.played ?? 0 },
    ]);
    return true;
  }
  if (url.includes("/rest/v1/quiz_questions")) {
    void json(
      route,
      200,
      quiz.rows.map(({ correct, answerCount, played, ...row }) => ({
        ...row,
        answer_count: answerCount ?? 0,
        revealed_at: played ? "2026-10-23T19:00:00Z" : null,
        quiz_answer_keys: correct === null ? null : { correct },
      })),
    );
    return true;
  }
  return false;
}

interface FakeHostPanelOptions {
  code: string;
  enabledModules: EventRow["enabled_modules"];
  status?: EventRow["status"];
  party?: EventRow["party"];
  quiz?: FakeQuizRow[];
  /** How many questions count as played. */
  played?: number;
  /** Who has answered the question on show, by user id. */
  answeredBy?: string[];
  /** What quiz_scores gives the host. */
  scores?: FakeQuiz["scores"];
  /** The texts of the award categories, in order. */
  awards?: string[];
  /** The guests of the event, on top of the host. */
  guests?: MemberRow[];
  /** The event's flow, on top of the lobby. */
  flow?: Partial<EventRow>;
}

/**
 * Fakes the reads the control panel makes once the host link is claimed: the
 * event lookup by code, the snapshot, the quiz questions with their keys, the
 * award categories and the realtime socket. Pair it with `fakeSupabase` for
 * sign-in and the claim.
 */
export async function fakeHostPanel(page: Page, options: FakeHostPanelOptions) {
  const event = eventRow({
    code: options.code,
    enabled_modules: options.enabledModules,
    ...options.flow,
    ...(options.status && { status: options.status }),
    ...(options.party && { party: options.party }),
  });
  const host = memberRow({ role: "host" });

  await page.route(`${supabase}/rest/v1/**`, (route) => {
    if (answerPreflight(route)) return;
    const url = route.request().url();
    // Before the event lookups: `event_id=eq.` also contains `id=eq.`.
    const quiz = {
      rows: options.quiz ?? [],
      played: options.played,
      answeredBy: options.answeredBy,
      scores: options.scores,
    };
    if (answerQuiz(route, quiz)) return;
    if (url.includes("/rest/v1/award_categories")) {
      return json(
        route,
        200,
        (options.awards ?? []).map((text, position) => ({
          id: `a${position}`,
          position,
          text,
          vote_count: 0,
          revealed_at: null,
        })),
      );
    }
    if (url.includes("code=eq.")) {
      return json(route, 200, [
        { id: fakeEventId, members: [{ user_id: "u1", role: "host" }] },
      ]);
    }
    if (url.includes("id=eq.")) {
      return json(route, 200, [
        { ...event, members: [host, ...(options.guests ?? [])] },
      ]);
    }
    return json(route, 404, { error: "unexpected request" });
  });

  await fakeRealtime(page);
}
