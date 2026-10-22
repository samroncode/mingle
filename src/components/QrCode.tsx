import { QRCodeSVG } from "qrcode.react";

interface QrCodeProps {
  value: string;
  label: string;
  size?: number;
}

/**
 * The one QR code component; views never import qrcode.react directly. Drawn
 * black on white with a quiet zone so phones scan it on any theme.
 */
export function QrCode({ value, label, size = 256 }: QrCodeProps) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      title={label}
      role="img"
      aria-label={label}
      marginSize={4}
      bgColor="#ffffff"
      fgColor="#000000"
      className="h-auto max-w-full rounded-lg"
    />
  );
}
