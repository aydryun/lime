import { describe, expectTypeOf, mock, test } from "bun:test";

import { parseIdParam } from "../../src/organisations.ts";

describe("parseIdParam", () => {
  test("Conversion string => number (Chiffre)", () => {
    const parsedId = parseIdParam("9");
    expectTypeOf(parsedId).toBeNumber;
  });

  test("Conversion string => number (Nombre)", () => {
    const parsedId = parseIdParam("42");
    expectTypeOf(parsedId).toBeNumber;
  });

  test("Erreur Conversion string Invalide", () => {
    const parsedId = parseIdParam("text-invalide");
    expectTypeOf(parsedId).toBeNull;
  });

  test("Conversion d'un chiffre negatif", () => {
    const parsedId = parseIdParam("-4");
    expectTypeOf(parsedId).toBeNull;
  });
});
