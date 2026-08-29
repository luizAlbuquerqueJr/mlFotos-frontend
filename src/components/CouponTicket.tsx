import type { CSSProperties } from "react";
import { formatBRL } from "@/lib/clientPackages";

interface CouponTicketProps {
  value: number;
  shakeLevel: 0 | 1 | 2 | 3 | 4;
  unlocked?: boolean;
  almostYours?: boolean;
  growing?: boolean;
}

const SHAKE = {
  0: { duration: "0s", rotate: "0deg", glow: "0 0 0 transparent" },
  1: { duration: "1.8s", rotate: "3deg", glow: "0 0 8px rgba(251, 191, 36, 0.22)" },
  2: { duration: "1.25s", rotate: "4deg", glow: "0 0 10px rgba(251, 191, 36, 0.32)" },
  3: { duration: "0.85s", rotate: "5.5deg", glow: "0 0 14px rgba(251, 191, 36, 0.45)" },
  4: { duration: "0.85s", rotate: "5.5deg", glow: "0 0 14px rgba(251, 191, 36, 0.45)" },
} as const;

export function CouponTicket({
  value,
  shakeLevel,
  unlocked = false,
  almostYours = false,
  growing = false,
}: CouponTicketProps) {
  const motion = SHAKE[shakeLevel];
  const label = unlocked ? "SEU CUPOM" : growing && almostYours ? "VIRA" : almostYours ? "QUASE SEU" : "CUPOM";

  return (
    <div
      className={`relative shrink-0 ${shakeLevel > 0 && !unlocked ? "coupon-wiggle" : ""} ${unlocked ? "coupon-unlocked" : ""}`}
      style={
        {
          "--coupon-duration": motion.duration,
          "--coupon-rotate": motion.rotate,
          filter: `drop-shadow(${motion.glow})`,
        } as CSSProperties
      }
      aria-hidden
    >
      <svg viewBox="0 0 148 78" className="h-[72px] w-[136px]" role="img">
        <title>{`${label} ${formatBRL(value)}`}</title>
        <defs>
          <linearGradient id="coupon-paper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={unlocked ? "#fde68a" : "#fbbf24"} />
            <stop offset="100%" stopColor={unlocked ? "#f59e0b" : "#d97706"} />
          </linearGradient>
        </defs>
        <path
          d="M12 6h112c6.6 0 12 5.4 12 12v8c-4.4 0-8 3.6-8 8s3.6 8 8 8v12c0 6.6-5.4 12-12 12H12C5.4 66 0 60.6 0 54V42c4.4 0 8-3.6 8-8s-3.6-8-8-8V18C0 11.4 5.4 6 12 6Z"
          fill="url(#coupon-paper)"
        />
        <path
          d="M20 10h96"
          stroke="#7c2d12"
          strokeWidth="1.4"
          strokeDasharray="3 4"
          opacity="0.45"
        />
        <path
          d="M20 68h96"
          stroke="#7c2d12"
          strokeWidth="1.4"
          strokeDasharray="3 4"
          opacity="0.45"
        />
        <text
          x="68"
          y="28"
          textAnchor="middle"
          fill="#7c2d12"
          fontFamily="Raleway, system-ui, sans-serif"
          fontSize="9"
          fontWeight="700"
          letterSpacing="2.4"
        >
          {label}
        </text>
        <text
          x="68"
          y="52"
          textAnchor="middle"
          fill="#451a03"
          fontFamily="Cormorant Garamond, Georgia, serif"
          fontSize="22"
          fontWeight="600"
        >
          {formatBRL(value)}
        </text>
      </svg>
    </div>
  );
}
