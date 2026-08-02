import { sendMail } from "./smtp-client.mjs";

const [recipient, name, resetUrl] = process.argv.slice(2);

if (!recipient || !resetUrl) {
  throw new Error("Brug: password-reset-email-cli.mjs <mail> <navn> <link>");
}

const safeName = name || "bruger";
const subject = "Nulstil din adgangskode til SBR Portal";
const text = [
  `Hej ${safeName}`,
  "",
  "Der er blevet anmodet om at nulstille din adgangskode til SBR Portal.",
  "Åbn linket nedenfor inden for 30 minutter:",
  resetUrl,
  "",
  "Har du ikke selv bedt om dette, kan du ignorere mailen. Din nuværende adgangskode ændres ikke.",
  "",
  "SBR Portal"
].join("\n");
const html = `<!doctype html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f4f5f6;color:#18181b;font-family:Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:28px">
      <p style="margin:0;color:#b42318;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">SBR Portal</p>
      <h1 style="margin:10px 0 0;font-size:26px">Nulstil din adgangskode</h1>
      <p style="margin-top:18px;line-height:1.6">Hej ${escapeHtml(safeName)}</p>
      <p style="line-height:1.6">Der er blevet anmodet om at nulstille din adgangskode. Linket virker i 30 minutter og kan kun bruges én gang.</p>
      <p style="margin:24px 0"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#b42318;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">Vælg ny adgangskode</a></p>
      <p style="color:#52525b;font-size:14px;line-height:1.6">Har du ikke selv bedt om dette, kan du ignorere mailen. Din nuværende adgangskode ændres ikke.</p>
    </div>
  </div>
</body>
</html>`;

await sendMail({
  to: [recipient],
  subject,
  text,
  html
});

console.log(JSON.stringify({ sent: true }));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
