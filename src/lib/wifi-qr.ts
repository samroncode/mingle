import type { Party } from "@/lib/schemas/party";

type Wifi = NonNullable<Party["wifi"]>;

function escapeField(value: string): string {
  return value.replace(/[\\;,:"]/g, (char) => `\\${char}`);
}

/** The text a wifi QR code holds; an empty password means an open network. */
export function wifiQrText({ ssid, password }: Wifi): string {
  const name = escapeField(ssid);
  return password === ""
    ? `WIFI:T:nopass;S:${name};;`
    : `WIFI:T:WPA;S:${name};P:${escapeField(password)};;`;
}
