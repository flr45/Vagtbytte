export const OPERATIONAL_VIEW_KEYS = ["front", "right", "rear", "left", "roof"] as const;
export type OperationalVehicleViewKey = (typeof OPERATIONAL_VIEW_KEYS)[number];

export const OPERATIONAL_VIEW_CONFIG: Record<OperationalVehicleViewKey, { label: string; sortOrder: number }> = {
  front: { label: "Front", sortOrder: 0 },
  right: { label: "Højre side", sortOrder: 1 },
  rear: { label: "Bagende", sortOrder: 2 },
  left: { label: "Venstre side", sortOrder: 3 },
  roof: { label: "Tag", sortOrder: 4 }
};

export type OperationalVehicleView = {
  id: string;
  vehicleId: string;
  viewKey: OperationalVehicleViewKey;
  label: string;
  imageId: string;
  sortOrder: number;
};

export type OperationalVehicleViewHotspot = {
  id: string;
  vehicleId: string;
  placeId: string;
  placeName: string;
  viewKey: OperationalVehicleViewKey;
  label: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  sortOrder: number;
};
