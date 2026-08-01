import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { sendMail } from "./smtp-client.mjs";

const servers = new Set();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise((resolve) => {
          server.close(() => resolve());
        })
    )
  );
  servers.clear();
});

describe("SMTP-klient", () => {
  it("opretter Message-ID fra envelope-afsenderens domæne", async () => {
    let receivedMessage = "";
    const server = net.createServer((socket) => {
      socket.setEncoding("utf8");
      socket.write("220 smtp.test ESMTP\r\n");
      let buffer = "";
      let receivingData = false;

      socket.on("data", (chunk) => {
        buffer += chunk;
        while (buffer.includes("\n")) {
          const index = buffer.indexOf("\n");
          const line = buffer.slice(0, index + 1).replace(/\r?\n$/, "");
          buffer = buffer.slice(index + 1);

          if (receivingData) {
            if (line === ".") {
              receivingData = false;
              socket.write("250 2.0.0 queued\r\n");
            } else {
              receivedMessage += `${line}\n`;
            }
            continue;
          }

          if (line.startsWith("EHLO ")) {
            socket.write("250-smtp.test\r\n250 PIPELINING\r\n");
          } else if (line.startsWith("MAIL FROM:")) {
            socket.write("250 2.1.0 ok\r\n");
          } else if (line.startsWith("RCPT TO:")) {
            socket.write("250 2.1.5 ok\r\n");
          } else if (line === "DATA") {
            receivingData = true;
            socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
          } else if (line === "QUIT") {
            socket.write("221 2.0.0 bye\r\n");
            socket.end();
          }
        }
      });
    });
    servers.add(server);

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Testserveren mangler en port");

    const result = await sendMail(
      {
        to: ["modtager@example.dk"],
        subject: "Test",
        text: "Testtekst",
        html: "<p>Testtekst</p>"
      },
      {
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(address.port),
        SMTP_SECURE: "false",
        SMTP_STARTTLS: "false",
        SMTP_FROM: "info@racher.dk",
        SMTP_FROM_NAME: "Vagtbytte",
        SMTP_HELO_NAME: "vagtbytte.racher.dk"
      }
    );

    expect(result.messageId).toMatch(/^<[^>]+@racher\.dk>$/);
    expect(receivedMessage).toContain(`Message-ID: ${result.messageId}`);
    expect(receivedMessage).toContain("From: Vagtbytte <info@racher.dk>");
  });
});
