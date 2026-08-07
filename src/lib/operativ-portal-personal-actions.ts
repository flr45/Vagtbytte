"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOperationalPortalAccess } from "./auth";
import { isOperationalFavorite, resolveOperationalTarget } from "./operativ-portal-personal";
import { prisma } from "./prisma";

const inputSchema = z.object({
  type: z.enum(["vehicle", "place", "item"]),
  id: z.string().uuid(),
  favorite: z.boolean()
});

export async function setOperationalFavoriteAction(input: unknown) {
  const user = await requireOperationalPortalAccess();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Favoritten er ugyldig." };

  try {
    const target = await resolveOperationalTarget(parsed.data.type, parsed.data.id);
    if (!target) return { ok: false as const, error: "Indholdet blev ikke fundet." };

    if (parsed.data.favorite) {
      await prisma.$executeRaw`
        INSERT INTO operational_favorite (id, user_id, target_type, target_id)
        VALUES (${randomUUID()}::uuid, ${user.id}, ${parsed.data.type}, ${parsed.data.id})
        ON CONFLICT (user_id, target_type, target_id) DO NOTHING
      `;
    } else {
      await prisma.$executeRaw`
        DELETE FROM operational_favorite
        WHERE user_id = ${user.id}
          AND target_type = ${parsed.data.type}
          AND target_id = ${parsed.data.id}
      `;
    }

    const favorite = await isOperationalFavorite(user.id, parsed.data.type, parsed.data.id);
    revalidatePath("/admin/operativ-portal/favoritter");
    revalidatePath(target.href);
    return { ok: true as const, favorite };
  } catch (error) {
    console.error("OPERATIONAL_FAVORITE_SAVE_FAILED", error);
    return { ok: false as const, error: "Favoritten kunne ikke gemmes. Prøv igen." };
  }
}
