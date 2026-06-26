import { describe, expect, mock, test } from "bun:test";
import jwt from "jsonwebtoken";

const TEST_SECRET = "test-secret-for-unit-tests";

mock.module("../../src/config.js", () => ({
  JWT_SECRET: TEST_SECRET,
}));

import { createActivationToken } from "../../src/auth.js";

describe("createActivationToken()", () => {
  test("retourne une chaîne de caractères", () => {
    const token = createActivationToken(1);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  test("contient le bon userId dans le payload", () => {
    const token = createActivationToken(42);
    const payload = jwt.verify(token, TEST_SECRET) as {
      userId: number;
      purpose: string;
    };
    expect(payload.userId).toBe(42);
  });

  test("a pour purpose 'activation'", () => {
    const token = createActivationToken(1);
    const payload = jwt.verify(token, TEST_SECRET) as { purpose: string };
    expect(payload.purpose).toBe("activation");
  });

  test("produit des tokens différents pour des userId différents", () => {
    const tokenA = createActivationToken(1);
    const tokenB = createActivationToken(2);
    expect(tokenA).not.toBe(tokenB);
  });

  test("le token expire dans le futur (7 jours)", () => {
    const token = createActivationToken(1);
    const payload = jwt.verify(token, TEST_SECRET) as { exp: number };
    const now = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeGreaterThanOrEqual(now + 604800 - 10);
    expect(payload.exp).toBeLessThanOrEqual(now + 604800 + 10);
  });
});
