const SMS_PHONE_PATTERN = /^\+?[1-9]\d{6,14}$/;

export function normalizeSmsPhoneNumber(value: string) {
  let phone = String(value ?? "").replace(/[\s()-]/g, "");
  if (phone.startsWith("00")) {
    phone = `+${phone.slice(2)}`;
  }
  if (/^\d{8}$/.test(phone)) {
    phone = `+45${phone}`;
  }
  if (!SMS_PHONE_PATTERN.test(phone)) {
    throw new Error("Ugyldigt telefonnummer");
  }
  return phone;
}
