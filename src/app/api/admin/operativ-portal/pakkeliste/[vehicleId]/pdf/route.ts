import { NextResponse } from "next/server";
import { canAccessOperationalPortal, getCurrentUser } from "@/lib/auth";
import { createPackingListPdf } from "@/lib/operativ-packing-list";
import { getOperationalPlace, getOperationalVehicle } from "@/lib/operativ-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = { params: Promise<{ vehicleId: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Log ind for at fortsætte." }, { status: 401 });
  if (!canAccessOperationalPortal(user)) {
    return NextResponse.json({ error: "Du har ikke adgang til Operativ Portal." }, { status: 403 });
  }

  const { vehicleId } = await params;
  const vehicle = await getOperationalVehicle(vehicleId);
  if (!vehicle) return NextResponse.json({ error: "Køretøjet blev ikke fundet." }, { status: 404 });

  const placeDetails = await Promise.all(vehicle.places.map((place) => getOperationalPlace(place.id)));
  const pdf = createPackingListPdf({
    vehicleName: vehicle.name,
    code: vehicle.code,
    model: vehicle.model,
    places: placeDetails
      .filter((place): place is NonNullable<typeof place> => Boolean(place))
      .map((place) => ({
        name: place.name,
        description: place.description,
        items: place.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          note: item.note,
          specifications: item.specifications
        }))
      }))
  });

  const fileBase = (vehicle.code || vehicle.name || "koeretoej")
    .replace(/[^A-Za-z0-9ÆØÅæøå_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "koeretoej";

  return new Response(pdf, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${fileBase}-pakkeliste.pdf`)}`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
