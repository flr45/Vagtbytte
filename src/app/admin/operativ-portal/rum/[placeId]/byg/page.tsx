import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppIcon } from "@/components/AppIcon";
import { OperationalContentBuilder } from "@/components/OperationalContentBuilder";
import {
  OperationalPageFrame,
  OperationalPortalNav,
  OperationalScreenHeader
} from "@/components/OperationalPortalNav";
import { requireRole } from "@/lib/auth";
import { getOperationalInteractiveContext } from "@/lib/operativ-content-builder";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ placeId: string }>;
  searchParams: Promise<{ node?: string | string[] }>;
};

export default async function OperationalContentBuilderPage({ params, searchParams }: PageProps) {
  await requireRole(UserRole.ADMIN);
  const { placeId } = await params;
  const query = await searchParams;
  const nodeId = typeof query.node === "string" ? query.node : null;
  const context = await getOperationalInteractiveContext(placeId, nodeId);
  if (!context) notFound();

  const base = `/admin/operativ-portal/rum/${placeId}/byg`;
  const backHref = context.nodeId
    ? context.parentNodeId
      ? `${base}?node=${encodeURIComponent(context.parentNodeId)}`
      : base
    : `/admin/operativ-portal/rum/${placeId}`;

  return (
    <OperationalPageFrame>
      <OperationalScreenHeader
        backHref={backHref}
        right={<AppIcon className="size-5" name="edit" />}
        title={`${context.nodeId ? "Redigér" : "Byg"} · ${context.nodeName || context.placeName}`}
      />
      <OperationalPortalNav isEditor />
      <OperationalContentBuilder context={context} />
    </OperationalPageFrame>
  );
}
