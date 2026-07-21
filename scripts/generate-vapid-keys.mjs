import { createECDH } from "crypto";

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();

console.log("Tilføj disse værdier til .env:");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${base64url(ecdh.getPublicKey())}"`);
console.log(`VAPID_PRIVATE_KEY="${base64url(ecdh.getPrivateKey())}"`);
console.log('VAPID_SUBJECT="mailto:lokal@vagtbytte.test"');
