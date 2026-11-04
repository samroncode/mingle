/** The longest message the Swish app shows and stores. */
const MESSAGE_MAX = 50;

/**
 * The message to prefill in Swish: "Mingle K7Q2 Anna". Swish only accepts
 * letters, digits and a few marks, so accents are dropped where a plain
 * letter remains, dashes become hyphens and anything else becomes a space.
 * Cut to 50 characters.
 */
export function swishMessage(code: string, guestName: string): string {
  const cleaned = [
    ...`Mingle ${code} ${guestName}`.replace(/[\u2010-\u2015]/g, "-"),
  ]
    .map(toAllowed)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return [...cleaned].slice(0, MESSAGE_MAX).join("").trim();
}

const ALLOWED = /^[A-Za-z0-9åäöÅÄÖéÉüÜ.,:;?!()'"\s-]$/;

/** The character itself, its accent-free form, or a space. */
function toAllowed(char: string): string {
  if (ALLOWED.test(char)) return char;
  const plain = char.normalize("NFD").replace(/\p{M}/gu, "");
  return ALLOWED.test(plain) ? plain : " ";
}

/** A number as Swish wants it: digits only, country code 46 for mobiles. */
export function swishPayee(stored: string): string {
  const digits = stored.replace(/\D/g, "");
  if (digits.startsWith("46")) return digits;
  return digits.startsWith("0") ? `46${digits.slice(1)}` : digits;
}

/**
 * The link that opens the Swish app with the payment filled in, as Swish's
 * documentation describes it: `https://app.swish.nu/1/p/sw/?sw=<46…number>&amt=<kr>.0&msg=<text>`.
 * With `amt` and `msg` present and no `edit` parameter, both fields are
 * locked in the payment form. Add `edit=amt,msg` to let the payer change them.
 */
export function swishAppLink(args: {
  number: string;
  amount: number;
  message: string;
}): string {
  const query = [
    `sw=${swishPayee(args.number)}`,
    `amt=${args.amount.toFixed(1)}`,
    `msg=${encodeURIComponent(args.message)}`,
  ].join("&");
  return `https://app.swish.nu/1/p/sw/?${query}`;
}

/**
 * The text of a Swish QR code: `C<payee>;<amount>;<message>;<mask>`. The
 * mask is a bit sum of the fields the payer may edit (payee 1, amount 2,
 * message 4); the bill is not editable, so 0.
 */
export function swishQrText(args: {
  number: string;
  amount: number;
  message: string;
}): string {
  const payee = swishPayee(args.number);
  return `C${payee};${args.amount.toFixed(2).replace(".", ",")};${encodeURIComponent(args.message)};0`;
}
