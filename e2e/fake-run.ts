import type { Page, Route } from "@playwright/test";
import {
  eventRow,
  memberRow,
  type EventRow,
  type MemberRow,
} from "./fake-rows.ts";
import { supabase } from "./fake-supabase.ts";

export type RunModule = "quiz" | "awards" | "hottakes";
/** A question or category open, the same one revealed, or the closing step. */
export type RunScreen = "open" | "revealed" | "end";

const members: MemberRow[] = [
  memberRow({ user_id: "u1", display_name: "Anna" }),
  memberRow({ user_id: "g2", display_name: "Bertil" }),
  memberRow({ user_id: "g3", display_name: "Cecilia" }),
  memberRow({ user_id: "t1", role: "tv", display_name: null }),
];

/** The event with `module` running on its first item (or its end), plus its members. */
export function runEvent(
  code: string,
  niche: string,
  module: RunModule,
  screen: RunScreen,
): EventRow & { members: MemberRow[] } {
  return {
    ...eventRow({
      code,
      niche,
      enabled_modules: [module],
      status: "live",
      current_module: module,
      current_step: screen === "end" ? 2 : 0,
      phase: screen === "open" ? "open" : "revealed",
    }),
    members,
  };
}

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Answers the reads of a running quiz, awards or hot takes with two items, the
 * first one open or revealed, and nobody having answered yet. Register it after
 * `fakeEvent` or `fakeTv`, which it overrides for the module's own tables.
 */
export async function fakeRun(page: Page, screen: RunScreen) {
  const revealed = screen !== "open";
  const answers: Record<string, unknown> = {
    "/rpc/quiz_progress": [{ total: 2, played: revealed ? 1 : 0 }],
    "/quiz_questions": [
      {
        id: "q1",
        position: 0,
        text: "Which city is the capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        answer_count: 2,
        quiz_answer_keys: revealed ? { correct: 2 } : null,
      },
    ],
    "/rpc/quiz_votes": [
      { option: 0, votes: 1 },
      { option: 1, votes: 0 },
      { option: 2, votes: 5 },
      { option: 3, votes: 2 },
    ],
    "/rpc/quiz_scores": [
      { user_id: "u1", display_name: "Anna", score: 2, place: 1 },
      { user_id: "g2", display_name: "Bertil", score: 1, place: 2 },
      { user_id: "g3", display_name: "Cecilia", score: 1, place: 2 },
    ],
    "/quiz_answers": [],
    "/rpc/award_progress": [{ total: 2, revealed: revealed ? 1 : 0 }],
    "/award_categories": [
      {
        id: "c1",
        position: 0,
        text: "Most likely to dance on a table",
        vote_count: 2,
        revealed_at: revealed ? "2026-10-29T20:00:00Z" : null,
      },
    ],
    "/rpc/award_winners": [{ user_id: "g2", votes: 4 }],
    "/rpc/award_results": [
      {
        category_id: "c1",
        category_position: 0,
        category_text: "Most likely to dance on a table",
        user_id: "g2",
        votes: 4,
      },
      {
        category_id: "c2",
        category_position: 1,
        category_text: "Most likely to leave without saying goodbye",
        user_id: "g3",
        votes: 3,
      },
    ],
    "/rpc/my_award_votes": [{ votes: 2 }],
    "/rpc/awards_won": [{ user_id: "u1", awards: 1 }],
    "/award_votes": [],
    "/rpc/hot_take_progress": [{ total: 2, revealed: revealed ? 1 : 0 }],
    "/hot_takes": [
      {
        id: "h1",
        position: 0,
        text: "Pineapple belongs on pizza",
        answer_count: 3,
        revealed_at: revealed ? "2026-10-29T20:00:00Z" : null,
      },
    ],
    "/rpc/hot_take_result": revealed
      ? [{ agree_count: 5, disagree_count: 2 }]
      : [],
    "/rpc/hot_take_highlights": [
      {
        highlight: "agreed",
        hot_take_id: "h2",
        hot_take_position: 1,
        hot_take_text: "Mondays are fine",
        agree_count: 6,
        disagree_count: 0,
      },
      {
        highlight: "divisive",
        hot_take_id: "h1",
        hot_take_position: 0,
        hot_take_text: "Pineapple belongs on pizza",
        agree_count: 4,
        disagree_count: 3,
      },
    ],
    "/rpc/my_hot_take_majority": [{ sided: 1, answered: 2 }],
    "/hot_take_answers": [{ agree: true }],
  };
  await page.route(`${supabase}/rest/v1/**`, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/rest/v1", "");
    const body = answers[path];
    if (body === undefined) return route.fallback();
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            request.headers()["access-control-request-headers"] ?? "*",
          "access-control-allow-methods": "*",
        },
      });
    }
    return json(route, body);
  });
}
