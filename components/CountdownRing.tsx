"use client";

interface CountdownRingProps {
  remaining: number;
  period: number;
  size?: number;
  stroke?: number;
}

export function CountdownRing({ remaining, period, size = 40, stroke = 3.5 }: CountdownRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, remaining / period));
  const offset = circumference * (1 - fraction);
  const urgent = remaining <= 5;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={urgent ? "stroke-danger" : "stroke-accent"}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span
        className={`absolute text-[11px] font-semibold tabular-nums ${urgent ? "text-danger" : "text-muted"}`}
      >
        {remaining}
      </span>
    </div>
  );
}
