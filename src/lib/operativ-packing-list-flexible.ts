import {
  normalizeKey,
  normalizePlaceKey,
  type ParsedPackingListRow
} from "./operativ-packing-list";

/**
 * Parser til faktiske brandvæsens-pakkelister.
 *
 * Understøtter både den kompakte programvenlige PDF og den læsbare tabeludgave,
 * hvor et rum står som overskrift efterfulgt af "Antal Benævnelse".
 */
export function parseOperationalPackingListText(text: string): ParsedPackingListRow[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const rows: ParsedPackingListRow[] = [];
  let currentPlace = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = clean(lines[index] ?? "");
    if (!line || isPackingListNoise(line)) continue;

    if (isPlaceHeading(lines, index, line)) {
      currentPlace = clean(line.replace(/[:：]\s*$/, ""));
      continue;
    }

    if (!currentPlace) continue;
    const item = parseItem(line);
    if (!item) continue;

    rows.push({
      sourceLine: index + 1,
      placeName: currentPlace,
      itemName: item.name,
      quantity: item.quantity,
      note: item.note,
      confidence: item.confidence,
      reason: item.reason
    });
  }

  return aggregateRows(rows);
}

function isPlaceHeading(lines: string[], index: number, line: string) {
  if (looksLikeKnownPlace(line)) return true;

  // I den læsbare PDF står alle rumnavne umiddelbart før kolonneoverskriften.
  const next = nextMeaningfulLine(lines, index + 1);
  return Boolean(next && /^antal\s+ben[æe]vnelse$/i.test(next));
}

function nextMeaningfulLine(lines: string[], start: number) {
  for (let index = start; index < lines.length; index += 1) {
    const line = clean(lines[index] ?? "");
    if (line) return line;
  }
  return "";
}

function looksLikeKnownPlace(value: string) {
  const line = clean(value);
  if (!line || line.length > 90) return false;

  return /^(?:h\s*\d{1,2}|v\s*\d{1,2}|rum\s*\d{1,2}(?:\s*[-–].+)?|skab\s*\d{1,2}(?:\s*[-–].+)?|førerhus(?:\s*[-–]\s*handskerum)?|førerkabine|mandskabskabine(?:\s*\(.+\))?|hylde\s*system(?:\s*\(.+\))?|hyldesystem(?:\s*\(.+\))?|bagvæg|under\s+sæder|under\s+(?:højre|venstre)\s+trinbræt|på\s+taget|tag|(?:højre|venstre|venstreside)\s*(?:side\s*)?(?:forreste|midterste|bagerste)\s+rum(?:\s*\(.+\))?|udtrækshylde|pumpehuset|pumpe\s*panel|pumpepanel|faldsikringsudstyr(?:\s*\(.+\))?|brandsårs\s+kit|førstehjælpstaske(?:\s*\(lille\))?|skorstensudstyr|værktøjskuffert|kabine|front|bagende)$/i.test(line);
}

function parseItem(value: string) {
  const line = clean(value)
    .replace(/^[•·▪◦►▶-]\s*/, "")
    .replace(/^\d+[.)]\s+/, "");
  if (!line || isPackingListNoise(line) || looksLikeKnownPlace(line)) return null;

  const explicitX = line.match(/^(\d{1,3})\s*[x×]\s+(.+)$/i);
  if (explicitX) {
    return itemResult(explicitX[2], Number(explicitX[1]), 0.97, "Antal og udstyr fundet i '2 x udstyr'-format");
  }

  // De faktiske M2-tabeller bruger fx "2 Røgdykkerlygter" uden et x.
  const leadingNumber = line.match(/^(\d{1,3})\s+(.+)$/);
  if (leadingNumber) {
    return itemResult(leadingNumber[2], Number(leadingNumber[1]), 0.97, "Antal og udstyr fundet i tabelrækken");
  }

  // X betyder at originalen ikke angiver et præcist antal. Bevar posten, men markér den til kontrol.
  const unspecified = line.match(/^[x×]\s+(.+)$/i);
  if (unspecified) {
    return itemResult(unspecified[1], 1, 0.72, "Originalen angiver X i stedet for et præcist antal; kontrollér antal");
  }

  // Uden antal er teksten typisk indhold i en kasse. Den medtages til preview,
  // så administratoren kan rette den før import i stedet for at den forsvinder.
  if (line.length >= 2 && line.length <= 220) {
    return itemResult(line, 1, 0.82, "Udstyr fundet under et rum; antal antaget til 1");
  }

  return null;
}

function itemResult(nameValue: string, quantityValue: number, confidence: number, reason: string) {
  const name = clean(nameValue.replace(/;\s*/g, "; "));
  if (!name || name.length > 220) return null;
  return {
    name,
    quantity: clampQuantity(quantityValue),
    note: "",
    confidence,
    reason
  };
}

function isPackingListNoise(value: string) {
  const line = clean(value);
  if (!line) return true;
  if (/^\d{1,3}$/.test(line)) return true;
  if (/^antal\s+ben[æe]vnelse$/i.test(line)) return true;
  if (/^side\s+\d+(?:\s+af\s+\d+)?$/i.test(line)) return true;
  if (/^slagelse\s+brand\s+og\s+redning(?:\s|$)/i.test(line)) return true;
  if (/^station\s+slagelse(?:\s|$)/i.test(line)) return true;
  if (/^pakningsliste\s+for\s+automobilsprøjte(?:\s|$)/i.test(line)) return true;
  if (/^m2$/i.test(line)) return true;
  if (/^dato\s*:/i.test(line)) return true;
  if (/^digitaliseret(?:,|\s)/i.test(line)) return true;
  if (/^denne\s+version\s+er\s+sat\s+op/i.test(line)) return true;
  if (/^formuleringer\s+og\s+mængder/i.test(line)) return true;
  if (/^(?:pakkeliste|indhold|udstyr|materiel|placering|bemærkning|note|navn|beskrivelse|specifikationer)$/i.test(line)) return true;
  return false;
}

function aggregateRows(rows: ParsedPackingListRow[]) {
  const result = new Map<string, ParsedPackingListRow>();
  for (const row of rows) {
    const key = `${normalizePlaceKey(row.placeName)}::${normalizeKey(row.itemName)}`;
    const existing = result.get(key);
    if (!existing) {
      result.set(key, row);
      continue;
    }
    result.set(key, {
      ...existing,
      quantity: clampQuantity(existing.quantity + row.quantity),
      confidence: Math.min(existing.confidence, row.confidence),
      reason: `${existing.reason}; gentaget i originalen`
    });
  }
  return Array.from(result.values());
}

function clean(value: string) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\f/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clampQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(999, Math.max(1, Math.trunc(value)));
}
