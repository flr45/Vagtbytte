const COPENHAGEN_TIME_ZONE = "Europe/Copenhagen";
const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const copenhagenFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: COPENHAGEN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: COPENHAGEN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function parseCopenhagenDateTimeLocal(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Tidspunkt skal udfyldes korrekt.");
  }

  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
  if (!match) {
    throw new Error("Tidspunkt skal angives som dato og klokkeslæt.");
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const wanted = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText)
  };

  if (
    wanted.month < 1 ||
    wanted.month > 12 ||
    wanted.day < 1 ||
    wanted.day > 31 ||
    wanted.hour > 23 ||
    wanted.minute > 59
  ) {
    throw new Error("Tidspunktet er ugyldigt.");
  }

  const localAsUtc = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  const candidates: Date[] = [];

  for (let offsetMinutes = -180; offsetMinutes <= 180; offsetMinutes += 15) {
    const candidate = new Date(localAsUtc - offsetMinutes * 60 * 1000);
    if (matchesCopenhagenLocalTime(candidate, wanted)) {
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    throw new Error("Tidspunktet findes ikke i dansk tid.");
  }

  return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
}

export function formatDateTimeLocalForConfirmation(value: string) {
  try {
    const date = parseCopenhagenDateTimeLocal(value);
    return new Intl.DateTimeFormat("da-DK", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: COPENHAGEN_TIME_ZONE
    }).format(date);
  } catch {
    return value || "Ikke valgt";
  }
}

export function calculateCopenhagenShiftEnd(startAt: Date) {
  const parts = Object.fromEntries(localDateFormatter.formatToParts(startAt).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const localMinutes = hour * 60 + minute;

  if (localMinutes < 7 * 60) {
    return parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T07:00`);
  }
  if (localMinutes < 15 * 60) {
    return parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T15:00`);
  }
  if (localMinutes < 23 * 60) {
    return parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T23:00`);
  }

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = String(nextDay.getUTCFullYear()).padStart(4, "0");
  const nextMonth = String(nextDay.getUTCMonth() + 1).padStart(2, "0");
  const nextDate = String(nextDay.getUTCDate()).padStart(2, "0");
  return parseCopenhagenDateTimeLocal(`${nextYear}-${nextMonth}-${nextDate}T07:00`);
}

export function calculateCopenhagenShiftWindow(now: Date) {
  const parts = Object.fromEntries(localDateFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const localMinutes = hour * 60 + minute;

  if (localMinutes < 7 * 60) {
    const previousDay = new Date(Date.UTC(year, month - 1, day - 1));
    const previousYear = String(previousDay.getUTCFullYear()).padStart(4, "0");
    const previousMonth = String(previousDay.getUTCMonth() + 1).padStart(2, "0");
    const previousDate = String(previousDay.getUTCDate()).padStart(2, "0");
    return {
      start: parseCopenhagenDateTimeLocal(`${previousYear}-${previousMonth}-${previousDate}T23:00`),
      end: parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T07:00`)
    };
  }

  if (localMinutes < 15 * 60) {
    return {
      start: parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T07:00`),
      end: parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T15:00`)
    };
  }

  if (localMinutes < 23 * 60) {
    return {
      start: parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T15:00`),
      end: parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T23:00`)
    };
  }

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = String(nextDay.getUTCFullYear()).padStart(4, "0");
  const nextMonth = String(nextDay.getUTCMonth() + 1).padStart(2, "0");
  const nextDate = String(nextDay.getUTCDate()).padStart(2, "0");
  return {
    start: parseCopenhagenDateTimeLocal(`${parts.year}-${parts.month}-${parts.day}T23:00`),
    end: parseCopenhagenDateTimeLocal(`${nextYear}-${nextMonth}-${nextDate}T07:00`)
  };
}

function matchesCopenhagenLocalTime(
  date: Date,
  wanted: { year: number; month: number; day: number; hour: number; minute: number }
) {
  const parts = Object.fromEntries(
    copenhagenFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return (
    Number(parts.year) === wanted.year &&
    Number(parts.month) === wanted.month &&
    Number(parts.day) === wanted.day &&
    Number(parts.hour) === wanted.hour &&
    Number(parts.minute) === wanted.minute
  );
}
