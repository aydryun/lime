import { describe, expect, mock, test } from "bun:test";
import jwt from "jsonwebtoken";

const SECRET = "test-secret";
// Le middleware lit JWT_SECRET depuis config.js : on le mocke pour un test autonome.
mock.module("../../src/config.js", () => ({ JWT_SECRET: SECRET }));

const { authenticate } = await import("../../src/middleware.ts");
const { TOKEN_COOKIE } = await import("../../src/auth.ts");

interface FakeReq {
  cookies?: Record<string, string>;
  headers: Record<string, string>;
  userId?: number;
  orgId?: number;
}

/** Réponse Express minimale capturant le status renvoyé. */
function mockRes() {
  return {
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
}

/** Exécute le middleware et indique s'il a appelé next(). */
function run(req: FakeReq) {
  const res = mockRes();
  let nextCalled = false;
  authenticate(req as never, res as never, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

describe("authenticate()", () => {
  test("sans token -> 401", () => {
    const { res, nextCalled } = run({ headers: {} });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  test("token Bearer valide -> next() + userId/orgId attachés", () => {
    const token = jwt.sign({ userId: 7, orgId: 3 }, SECRET);
    const req: FakeReq = { headers: { authorization: `Bearer ${token}` } };
    const { nextCalled } = run(req);
    expect(nextCalled).toBe(true);
    expect(req.userId).toBe(7);
    expect(req.orgId).toBe(3);
  });

  test("token valide via cookie HttpOnly -> next()", () => {
    const token = jwt.sign({ userId: 1, orgId: 1 }, SECRET);
    const { nextCalled } = run({ headers: {}, cookies: { [TOKEN_COOKIE]: token } });
    expect(nextCalled).toBe(true);
  });

  test("token illisible -> 401", () => {
    const { res, nextCalled } = run({ headers: { authorization: "Bearer pas.un.jwt" } });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  test("token sans orgId -> 401", () => {
    const token = jwt.sign({ userId: 7 }, SECRET);
    const { res, nextCalled } = run({ headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  test("token avec userId non numérique -> 401", () => {
    const token = jwt.sign({ userId: "sept", orgId: 3 }, SECRET);
    const { res, nextCalled } = run({ headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });
});
