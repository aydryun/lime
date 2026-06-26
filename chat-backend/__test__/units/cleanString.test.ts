import { describe, expect, expectTypeOf, test } from "bun:test";

import { cleanString } from "../../src/organisations.ts";

describe("cleanString()", () => {
  test("Cleanstring du mot '  test '", () => {
    const trimmedString = cleanString("  test ", 10);
    expect(trimmedString).toBe("test");
  });

  test("Lenght = 0", () => {
    const trimmedString = cleanString("", 10);
    expectTypeOf(trimmedString).toBeNull();
  });

  test("Longeur supérieur a maxLength", () => {
    const trimmedString = cleanString("string-plus-longue-que-ml", 10);
    expectTypeOf(trimmedString).toBeNull();
  });

  test("Parametre autre qu'une chaine de charateres", () => {
    const trimmedString = cleanString(10, 10);
    expectTypeOf(trimmedString).toBeNull();
  });
});
