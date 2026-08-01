export const STATIONS = [
  { code: "A", label: "Slagelse" },
  { code: "B", label: "Station B" },
  { code: "S", label: "Sorø" },
  { code: "K", label: "Korsør" },
  { code: "L", label: "Skælskør" },
  { code: "R", label: "Ruds Vedby" },
  { code: "ISL", label: "ISL" }
] as const;

export const STATION_CODE_VALUES = STATIONS.map((station) => station.code) as [
  "A",
  "B",
  "S",
  "K",
  "L",
  "R",
  "ISL"
];

export type StationCode = (typeof STATIONS)[number]["code"];

const STATION_LABELS = new Map<string, string>(
  STATIONS.map((station) => [station.code, station.label])
);

export function isStationCode(value: string | null | undefined): value is StationCode {
  return Boolean(value && STATION_LABELS.has(value));
}

export function stationLabel(value: string | null | undefined) {
  if (!value) return "Uden station";
  return STATION_LABELS.get(value) ?? value;
}

export function normalizeStationCodes(values: FormDataEntryValue[]) {
  return [...new Set(values.map(String).filter(isStationCode))] as StationCode[];
}
