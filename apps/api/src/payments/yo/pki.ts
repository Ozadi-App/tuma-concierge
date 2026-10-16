/**
 * Yo! Payments public-key authentication for acwithdrawfunds.
 *
 * Once Yo! turns PKI on for the account, every withdraw request must carry a
 * unique PublicKeyAuthenticationNonce and a PublicKeyAuthenticationSignatureBase64:
 * an RSA (PKCS#1 v1.5) / SHA-1 signature, made with our private key, over the
 * concatenation APIUsername + Amount + Account + Narrative + ExternalReference
 * + Nonce (Narrative, ExternalReference and Nonce truncated to 255 characters).
 * The API password is not part of the signed string. See API spec section
 * "Calculating the RSA-signature sent in the request".
 */

export type YoSignatureFields = {
  apiUsername: string;
  amount: string;
  account: string;
  narrative: string;
  externalReference: string;
  nonce: string;
};

const MAX_FIELD = 255;

export function signatureBase(f: YoSignatureFields): string {
  return (
    f.apiUsername +
    f.amount +
    f.account +
    f.narrative.slice(0, MAX_FIELD) +
    f.externalReference.slice(0, MAX_FIELD) +
    f.nonce.slice(0, MAX_FIELD)
  );
}

function derLength(n: number): number[] {
  if (n < 0x80) return [n];
  if (n < 0x100) return [0x81, n];
  return [0x82, n >> 8, n & 0xff];
}

/** Wraps a PKCS#1 RSAPrivateKey in a PKCS#8 PrivateKeyInfo (Web Crypto only imports PKCS#8). */
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLength(pkcs1.length)];
  const inner = [0x02, 0x01, 0x00, ...algId, ...octet];
  const total = inner.length + pkcs1.length;
  return Uint8Array.from([0x30, ...derLength(total), ...inner, ...pkcs1]);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Parses a PEM private key (PKCS#8 "BEGIN PRIVATE KEY" or PKCS#1 "BEGIN RSA
 * PRIVATE KEY"). Whitespace is stripped from the body, so a key pasted into a
 * single-line admin field still works.
 */
export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  if (/ENCRYPTED/.test(pem)) throw new Error("Yo! private key must not be passphrase-protected");
  const isPkcs1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("Yo! private key is empty");
  let der: Uint8Array;
  try {
    der = b64ToBytes(body);
  } catch {
    throw new Error("Yo! private key is not valid PEM");
  }
  if (isPkcs1) der = pkcs1ToPkcs8(der);
  try {
    return await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" }, false, ["sign"]);
  } catch {
    throw new Error("Yo! private key could not be read as an RSA private key");
  }
}

export async function signWithdraw(privateKeyPem: string, fields: YoSignatureFields): Promise<string> {
  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signatureBase(fields)));
  return bytesToB64(new Uint8Array(sig));
}
