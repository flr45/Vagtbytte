import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { authenticateLogin, hashSessionToken, type AuthRepository, type AuthUser } from "./auth-core";
import { hashPassword } from "./passwords";

function makeRepo(options: {
  user?: AuthUser | null;
  failures?: number;
  createdSessions?: Array<{ userId: string; tokenHash: string; expiresAt: Date }>;
  attempts?: Array<{ identifier: string; wasSuccessful: boolean; failureReason?: string }>;
  audits?: Array<{ action: string; description: string }>;
}): AuthRepository {
  return {
    async findUserByLogin() {
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
