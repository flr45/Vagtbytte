import net from "node:net";
import tls from "node:tls";
import { randomUUID } from "node:crypto";

export function smtpConfigured(env = process.env) {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

export function smtpConfigurationSummary(env = process.env) {
  return {
    configured: smtpConfigured(env),
    host: env.SMTP_HOST || null,
    port: Number(env.SMTP_PORT || (String(env.SMTP_SECURE).toLowerCase() === "true" ? 465 : 587)),
    secure: String(env.SMTP_SECURE ?? "false").toLowerCase() === "true",
    from: env.SMTP_FROM || null,
    authenticated: Boolean(env.SMTP_USER)
  };
}

export async function sendMail(message, env = process.env) {
  const config = readConfig(env);
  const connection = new SmtpConnection(config);
  const messageId = `<${randomUUID()}@${domainFromAddress(config.fromAddress)}>`;

  try {
    await connection.connect();
    await connection.expect([220]);
    let capabilities = await connection.command(`EHLO ${config.heloName}`, [250]);

    if (!config.secure && config.starttls && capabilities.lines.some((line) => /STARTTLS/i.test(line))) {
      await connection.command("STARTTLS", [220]);
      await connection.upgradeToTls();
      capabilities = await connection.command(`EHLO ${config.heloName}`, [250]);
    }

    if (config.user) {
      await authenticate(connection, capabilities.lines, config.user, config.password);
    }

    await connection.command(`MAIL FROM:<${config.envelopeFrom}>`, [250]);
    for (const recipient of message.to) {
      await connection.command(`RCPT TO:<${recipient}>`, [250, 251]);
    }
    await connection.command("DATA", [354]);
    const rawMessage = buildMimeMessage({
      ...message,
      from: config.fromHeader,
      messageId
    });
    await connection.data(rawMessage);
    await connection.command("QUIT", [221]).catch(() => null);

    return { messageId, recipients: message.to.length };
  } finally {
    connection.close();
  }
}

function readConfig(env) {
  if (!env.SMTP_HOST) throw new Error("SMTP_HOST mangler");
  if (!env.SMTP_FROM) throw new Error("SMTP_FROM mangler");
  const secure = String(env.SMTP_SECURE ?? "false").toLowerCase() === "true";
  const port = Number(env.SMTP_PORT || (secure ? 465 : 587));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT er ugyldig");
  const envelopeFrom = extractAddress(env.SMTP_FROM);
  if (!isEmail(envelopeFrom)) throw new Error("SMTP_FROM er ugyldig");

  return {
    host: env.SMTP_HOST,
    port,
    secure,
    starttls: String(env.SMTP_STARTTLS ?? "true").toLowerCase() !== "false",
    rejectUnauthorized: String(env.SMTP_ALLOW_SELF_SIGNED ?? "false").toLowerCase() !== "true",
    user: env.SMTP_USER || "",
    password: env.SMTP_PASSWORD || "",
    fromHeader: env.SMTP_FROM_NAME
      ? `${encodeHeader(env.SMTP_FROM_NAME)} <${envelopeFrom}>`
      : env.SMTP_FROM,
    envelopeFrom,
    heloName: env.SMTP_HELO_NAME || "vagtbytte.local"
  };
}

async function authenticate(connection, capabilityLines, user, password) {
  const authLine = capabilityLines.find((line) => /\bAUTH\b/i.test(line)) || "";
  if (/\bPLAIN\b/i.test(authLine)) {
    const token = Buffer.from(`\0${user}\0${password}`, "utf8").toString("base64");
    await connection.command(`AUTH PLAIN ${token}`, [235]);
    return;
  }

  await connection.command("AUTH LOGIN", [334]);
  await connection.command(Buffer.from(user, "utf8").toString("base64"), [334]);
  await connection.command(Buffer.from(password, "utf8").toString("base64"), [235]);
}

function buildMimeMessage({ from, to, subject, text, html, messageId }) {
  const boundary = `vagtbytte-${randomUUID()}`;
  const headers = [
    `Date: ${new Date().toUTCString()}`,
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    `Subject: ${encodeHeader(subject)}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(html),
    `--${boundary}--`,
    ""
  ];

  return [...headers, "", ...body]
    .join("\r\n")
    .replace(/^\./gm, "..");
}

function base64Lines(value) {
  return Buffer.from(value, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
}

function encodeHeader(value) {
  if (/^[\x20-\x7E]+$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function extractAddress(value) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function domainFromAddress(value) {
  return value.split("@")[1] || "vagtbytte.local";
}

class SmtpConnection {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.buffer = "";
    this.lines = [];
    this.waiters = [];
    this.failure = null;
  }

  async connect() {
    this.socket = this.config.secure
      ? tls.connect({
          host: this.config.host,
          port: this.config.port,
          servername: this.config.host,
          rejectUnauthorized: this.config.rejectUnauthorized
        })
      : net.connect({ host: this.config.host, port: this.config.port });
    this.bindSocket(this.socket);
    await onceConnected(this.socket, this.config.secure ? "secureConnect" : "connect");
  }

  async upgradeToTls() {
    const upgraded = tls.connect({
      socket: this.socket,
      servername: this.config.host,
      rejectUnauthorized: this.config.rejectUnauthorized
    });
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("error");
    this.socket = upgraded;
    this.buffer = "";
    this.lines = [];
    this.waiters = [];
    this.failure = null;
    this.bindSocket(upgraded);
    await onceConnected(upgraded, "secureConnect");
  }

  bindSocket(socket) {
    socket.setTimeout(30000, () => {
      this.fail(new Error("SMTP-forbindelsen fik timeout"));
      socket.destroy();
    });
    socket.on("data", (chunk) => {
      this.buffer += chunk.toString("utf8");
      let index;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index + 1).replace(/\r?\n$/, "");
        this.buffer = this.buffer.slice(index + 1);
        this.pushLine(line);
      }
    });
    socket.on("error", (error) => this.fail(error));
  }

  pushLine(line) {
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve(line);
    else this.lines.push(line);
  }

  fail(error) {
    this.failure = error;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  nextLine() {
    if (this.failure) return Promise.reject(this.failure);
    const line = this.lines.shift();
    if (line !== undefined) return Promise.resolve(line);
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async expect(expectedCodes) {
    const first = await this.nextLine();
    const match = first.match(/^(\d{3})([ -])(.*)$/);
    if (!match) throw new Error(`Ugyldigt SMTP-svar: ${first}`);
    const code = Number(match[1]);
    const lines = [first];
    if (match[2] === "-") {
      while (true) {
        const line = await this.nextLine();
        lines.push(line);
        if (line.startsWith(`${match[1]} `)) break;
      }
    }
    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP afviste kommandoen (${code}): ${lines.join(" | ")}`);
    }
    return { code, lines };
  }

  async command(value, expectedCodes) {
    this.socket.write(`${value}\r\n`, "utf8");
    return this.expect(expectedCodes);
  }

  async data(value) {
    this.socket.write(`${value}\r\n.\r\n`, "utf8");
    return this.expect([250]);
  }

  close() {
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
  }
}

function onceConnected(socket, eventName) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onConnected = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      socket.off("error", onError);
      socket.off(eventName, onConnected);
    };
    socket.once("error", onError);
    socket.once(eventName, onConnected);
  });
}
