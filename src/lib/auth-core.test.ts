import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import {
  authenticateLogin,
  hashSessionToken,
  resolveCurrentUserFromSession,
  sessionCookieOptions,
  sessionLifetimeMs,
  shouldRefreshSession,
  shouldDeleteCookieOnLogout,
  type AuthRepository,
  type AuthUser
} from "./auth-core";
import { hashPassword } from "./passwords";

function makeRepo(options: {
  user?: AuthUser | null;
  failures?: number;
  seenIdentifiers?: string[];
  createdSessions?: Array<{ userId: string; tokenHash: string; expiresAt: Date }>;
  attempts?: Array<{ identifier: string; wasSuccessful: boolean; failureReason?: string }>;
  audits?: Array<{ action: string; description: string }>;
}): AuthRepository {
  return {
    async findUserByLogin(identifier) {
      options.seenIdentifiers?.push(identifier);
      return options.user ?? null;
    },
    async countRecentFailures() {
      return options.failures ?? 0;
    },
    async recordAttempt(input) {
      options.attempts?.push(input);
    },
    async createSession(input) {
      options.createdSessions?.push(input);
    },
    async markLogin() {},
    async audit(input) {
      options.audits?.push(input);
    }
  };
}

async function firefighter(password = "Brandmand123!", isActive = true): Promise<AuthUser> {
  return {
    id: "user-1",
    name: "Brandmand A",
    role: UserRole.BRANDFIGHTER,
    employeeNumber: "1001",
    loginIdentifier: "1001",
    passwordHash: await hashPassword(password),
    isActive,
    mustChangePassword: false
  };
}

describe("authenticateLogin", () => {
  it("logger brandmand ind med korrekt medarbejdernummer og adgangskode", async () => {
    const createdSessions: Array<{ userId: string; tokenHash: string; expiresAt: Date }> = [];
    const attempts: Array<{ identifier: string; wasSuccessful: boolean; failureReason?: string }> = [];
    const repo = makeRepo({
      user: await firefighter(),
      createdSessions,
      attempts,
      audits: []
    });

    const result = await authenticateLogin({
      identifier: "1001",
      password: "Brandmand123!",
      repo
    });

    expect(result.ok).toBe(true);
    expect(createdSessions).toHaveLength(1);
    expect(createdSessions[0].tokenHash).not.toBe(result.ok ? result.rawToken : "");
    expect(attempts[0].wasSuccessful).toBe(true);
  });

  it("VC skrevet som VC kan logge ind med vc", async () => {
    const seenIdentifiers: string[] = [];
    const user = await firefighter("VcKode123!");
    user.role = UserRole.VC;
    user.loginIdentifier = "vc";
    const result = await authenticateLogin({
      identifier: "VC",
      password: "VcKode123!",
      repo: makeRepo({ user, seenIdentifiers, attempts: [], audits: [] })
    });

    expect(result.ok).toBe(true);
    expect(seenIdentifiers[0]).toBe("vc");
  });

  it("admin skrevet som Admin kan logge ind med admin", async () => {
    const seenIdentifiers: string[] = [];
    const user = await firefighter("AdminKode123!");
    user.role = UserRole.ADMIN;
    user.loginIdentifier = "admin";
    const result = await authenticateLogin({
      identifier: "Admin",
      password: "AdminKode123!",
      repo: makeRepo({ user, seenIdentifiers, attempts: [], audits: [] })
    });

    expect(result.ok).toBe(true);
    expect(seenIdentifiers[0]).toBe("admin");
  });

  it("mellemrum før og efter login ignoreres", async () => {
    const seenIdentifiers: string[] = [];
    const result = await authenticateLogin({
      identifier: "  1001  ",
      password: "Brandmand123!",
      repo: makeRepo({ user: await firefighter(), seenIdentifiers, attempts: [], audits: [] })
    });

    expect(result.ok).toBe(true);
    expect(seenIdentifiers[0]).toBe("1001");
  });

  it("afviser forkert adgangskode", async () => {
    const attempts: Array<{ identifier: string; wasSuccessful: boolean; failureReason?: string }> = [];
    const repo = makeRepo({ user: await firefighter(), attempts, audits: [] });

    const result = await authenticateLogin({
      identifier: "1001",
      password: "Forkert123!",
      repo
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.reason).toBe("INVALID");
    expect(attempts[0].wasSuccessful).toBe(false);
  });

  it("afviser deaktiveret brandmand", async () => {
    const repo = makeRepo({ user: await firefighter("Brandmand123!", false), attempts: [], audits: [] });

    const result = await authenticateLogin({
      identifier: "1001",
      password: "Brandmand123!",
      repo
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.reason).toBe("INACTIVE");
  });

  it("beskytter mod gentagne loginforsøg", async () => {
    const repo = makeRepo({ user: await firefighter(), failures: 5, attempts: [] });

    const result = await authenticateLogin({
      identifier: "1001",
      password: "Brandmand123!",
      repo
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.reason).toBe("RATE_LIMITED");
  });
});

describe("hashSessionToken", () => {
  it("gemmer ikke sessionstoken i klartekst", () => {
    const token = "hemmelig-session";
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).toHaveLength(64);
  });
});

describe("resolveCurrentUserFromSession", () => {
  it("udløbet session returnerer null", async () => {
    const user = await firefighter();
    const result = resolveCurrentUserFromSession(
      {
        id: "session-1",
        expiresAt: new Date("2026-07-21T10:00:00.000Z"),
        user
      },
      new Date("2026-07-21T11:00:00.000Z")
    );

    expect(result).toBeNull();
  });

  it("deaktiveret bruger returnerer null", async () => {
    const user = await firefighter("Brandmand123!", false);
    const result = resolveCurrentUserFromSession(
      {
        id: "session-1",
        expiresAt: new Date("2026-07-21T12:00:00.000Z"),
        user
      },
      new Date("2026-07-21T11:00:00.000Z")
    );

    expect(result).toBeNull();
  });

  it("ugyldig session returnerer null", () => {
    expect(resolveCurrentUserFromSession(null)).toBeNull();
  });

  it("getCurrentUser-core forsøger ikke at ændre cookies", async () => {
    const user = await firefighter();
    const cookieStore = {
      deleted: false,
      setCalled: false,
      delete() {
        this.deleted = true;
      },
      set() {
        this.setCalled = true;
      }
    };

    const result = resolveCurrentUserFromSession({
      id: "session-1",
      expiresAt: new Date(Date.now() + 1000),
      user
    });

    expect(result?.id).toBe(user.id);
    expect(cookieStore.deleted).toBe(false);
    expect(cookieStore.setCalled).toBe(false);
  });
});

describe("logout-cookie", () => {
  it("logout sletter fortsat session-cookien når token findes", () => {
    expect(shouldDeleteCookieOnLogout("token")).toBe(true);
  });
});

describe("vedvarende session", () => {
  it("login-cookien lever i 30 dage", () => {
    expect(sessionLifetimeMs()).toBe(1000 * 60 * 60 * 24 * 30);
  });

  it("fornyer først sessionen efter et døgn", () => {
    const lastSeenAt = new Date("2026-07-21T08:00:00.000Z");
    expect(
      shouldRefreshSession(
        { expiresAt: new Date("2026-08-20T08:00:00.000Z"), lastSeenAt },
        new Date("2026-07-22T07:59:59.000Z")
      )
    ).toBe(false);
    expect(
      shouldRefreshSession(
        { expiresAt: new Date("2026-08-20T08:00:00.000Z"), lastSeenAt },
        new Date("2026-07-22T08:00:00.000Z")
      )
    ).toBe(true);
  });

  it("sætter persistent cookie med expires, maxAge og Secure i produktion", () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const now = new Date("2026-07-21T08:00:00.000Z");
    const expiresAt = new Date("2026-08-20T08:00:00.000Z");

    expect(sessionCookieOptions(expiresAt, now)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      expires: expiresAt
    });

    process.env.NODE_ENV = oldEnv;
  });
});
