import { describe, expect, it } from "vitest";
import { healthStatus } from "./health";
import { validateProductionEnvironment } from "./production-env";

const bootstrapCore = await import("../../scripts/production-bootstrap-core.mjs");

describe("production health", () => {
  it("returnerer ok uden følsomme oplysninger, når databasen svarer", async () => {
    const result = await healthStatus(async () => 1);

    expect(result).toEqual({ status: 200, body: { status: "ok" } });
    expect(JSON.stringify(result.body)).not.toContain("DATABASE_URL");
  });

  it("returnerer fejlstatus ved manglende databaseforbindelse", async () => {
    const result = await healthStatus(async () => {
      throw new Error("database nede");
    });

    expect(result).toEqual({ status: 503, body: { status: "error" } });
  });
});

describe("produktionsmiljø", () => {
  it("kræver centrale miljøvariabler i produktion", () => {
    const result = validateProductionEnvironment({ NODE_ENV: "production" });

    expect(result.ok).toBe(false);
    expect(result.missing).toContain("DATABASE_URL");
    expect(result.missing).toContain("AUTH_SECRET");
    expect(result.missing).toContain("VAPID_PRIVATE_KEY");
  });

  it("godkender udfyldte produktionsvariabler", () => {
    const result = validateProductionEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@example.test:5432/db",
      AUTH_SECRET: "lang-hemmelig-session",
      VAPID_PRIVATE_KEY: "privat",
      VAPID_SUBJECT: "mailto:drift@example.test"
    });

    expect(result.ok).toBe(true);
  });
});

describe("produktionsbootstrap", () => {
  it("afviser manglende bootstrap-variabler", () => {
    const result = bootstrapCore.validateBootstrapEnv({});

    expect(result.ok).toBe(false);
    expect(result.message).toContain("BOOTSTRAP_ADMIN_USERNAME");
  });

  it("kan ikke køres to gange, når admin eller VC allerede findes", async () => {
    const result = await bootstrapCore.canBootstrapProductionUsers(makeBootstrapRepo({ existingCount: 1 }));

    expect(result.ok).toBe(false);
  });

  it("opretter første admin og VC med krav om adgangskodeskift", async () => {
    const repo = makeBootstrapRepo({ existingCount: 0 });
    const result = await bootstrapCore.bootstrapProductionUsers(repo, {
      BOOTSTRAP_ADMIN_USERNAME: "admin-prod",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminProd123!",
      BOOTSTRAP_VC_USERNAME: "vc-prod",
      BOOTSTRAP_VC_PASSWORD: "VcProd123!"
    });

    expect(result.ok).toBe(true);
    expect(repo.createdUsers).toHaveLength(2);
    expect(repo.createdUsers.every((user) => user.mustChangePassword)).toBe(true);
    expect(repo.createdUsers.map((user) => user.loginIdentifier)).toEqual(["admin-prod", "vc-prod"]);
    expect(JSON.stringify(repo.createdUsers)).not.toContain("AdminProd123!");
  });

  it("gemmer bootstrap-login med små bogstaver", async () => {
    const repo = makeBootstrapRepo({ existingCount: 0 });
    await bootstrapCore.bootstrapProductionUsers(repo, {
      BOOTSTRAP_ADMIN_USERNAME: " AdminProd ",
      BOOTSTRAP_ADMIN_PASSWORD: "AdminProd123!",
      BOOTSTRAP_VC_USERNAME: "VCProd",
      BOOTSTRAP_VC_PASSWORD: "VcProd123!"
    });

    expect(repo.createdUsers.map((user) => user.loginIdentifier)).toEqual(["adminprod", "vcprod"]);
  });
});

function makeBootstrapRepo({ existingCount }: { existingCount: number }) {
  const createdUsers: Array<{ id: string; loginIdentifier: string; mustChangePassword: boolean }> = [];
  return {
    createdUsers,
    user: {
      async count() {
        return existingCount;
      },
      create({ data }: { data: { loginIdentifier: string; mustChangePassword: boolean } }) {
        const user = { id: `user-${createdUsers.length + 1}`, ...data };
        createdUsers.push(user);
        return user;
      }
    },
    auditLog: {
      async createMany() {
        return { count: 2 };
      }
    },
    async $transaction<T>(operations: T[]) {
      return Promise.all(operations);
    }
  };
}
