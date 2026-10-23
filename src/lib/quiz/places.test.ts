import { describe, expect, it } from "vitest";
import { competitionPlaces } from "./places";
import { placeCases } from "./places.cases";

describe("competitionPlaces", () => {
  it.each(placeCases)("places $scores as $places", ({ scores, places }) => {
    expect(competitionPlaces(scores)).toEqual(places);
  });
});
