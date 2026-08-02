import { PrismaClient } from "@prisma/client";
import { isAlarmFollowUpNotification } from "./alarm-notification-policy";

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  }).$extends({
    query: {
      notification: {
        async create({ args, query }) {
          const data = args.data as typeof args.data & {
            type?: string;
            title?: string;
          };

          if (
            typeof data.type === "string" &&
            typeof data.title === "string" &&
            isAlarmFollowUpNotification({ type: data.type, title: data.title })
          ) {
            // Opfølgende sendinger skal ligge i alarmfeedet, men må hverken
            // give push eller fremstå som en ulæst notifikation i portalen.
            Object.assign(args.data, {
              publishedAt: null,
              cancelledAt: new Date()
            });
          }

          return query(args);
        }
      }
    }
  });
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: AppPrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
