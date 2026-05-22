// Generates a Pix "BR Code" (EMV) static payload string
// Spec: Banco Central do Brasil — Pix Copia e Cola
// Returns the payload string to be used in copy-paste and QR code.

function tlv(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(s: string, max: number) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, max);
}

export interface PixPayloadInput {
  key: string;
  name: string;
  city?: string;
  amount?: number;
  description?: string;
  txid?: string;
}

export function buildPixPayload({
  key,
  name,
  city = "BRASIL",
  amount,
  description,
  txid = "***",
}: PixPayloadInput) {
  const merchantAccount =
    tlv("00", "br.gov.bcb.pix") +
    tlv("01", key) +
    (description ? tlv("02", sanitize(description, 72)) : "");

  const additional = tlv("05", sanitize(txid || "***", 25));

  let payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (amount && amount > 0 ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", sanitize(name, 25)) +
    tlv("60", sanitize(city, 15)) +
    tlv("62", additional);

  payload += "6304";
  const crc = crc16(payload);
  return payload + crc;
}

// Internal chat marker: [[PIX:base64json]]
export interface PixMessage {
  key: string;
  keyType?: string;
  name: string;
  amount?: number;
  description?: string;
}

export function encodePixMessage(p: PixMessage): string {
  const json = JSON.stringify(p);
  const b64 = typeof window === "undefined"
    ? Buffer.from(json, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(json)));
  return `[[PIX:${b64}]]`;
}

export const PIX_REGEX = /\[\[PIX:([A-Za-z0-9+/=]+)\]\]/g;

export function decodePixMessage(b64: string): PixMessage | null {
  try {
    const json =
      typeof window === "undefined"
        ? Buffer.from(b64, "base64").toString("utf8")
        : decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
