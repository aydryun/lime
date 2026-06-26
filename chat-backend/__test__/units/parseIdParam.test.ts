import { describe, expect, test } from "bun:test";
import { parseIdParam } from "../../src/organisations.ts";

describe("parseIdParam()", () => {
  test("Conversion string => number (Chiffre)", () => {
    const parsedId = parseIdParam("9");
    expect(parsedId).toBe(9);
  });

  test("Conversion string => nombre (Nombre)", () => {
    const parsedId = parseIdParam("42");
    expect(parsedId).toBe(42);
  });

  test("Erreur Conversion string Invalide", () => {
    const parsedId = parseIdParam("text-invalide");
    expect(parsedId).toBeNull();
  });

  test("Conversion d'un chiffre negatif", () => {
    const parsedId = parseIdParam("-4");
    expect(parsedId).toBeNull();
  });
});
