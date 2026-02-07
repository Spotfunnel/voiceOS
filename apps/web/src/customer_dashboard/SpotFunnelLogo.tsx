import React from "react";
import { cn } from "@/shared_ui/lib/utils";

interface SpotFunnelLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export const SpotFunnelLogo = ({
  className = "",
  size = 32,
  color = "currentColor",
}: SpotFunnelLogoProps) => {
  return (
    <div className={cn("inline-flex items-center", className)}>
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill={color}
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="50" cy="24" r="17" />
          <path d="M 12 42 L 27 42 L 48 92 L 33 92 Z" />
          <path d="M 88 42 L 73 42 L 52 92 L 67 92 Z" />
        </svg>
      </div>
    </div>
  );
};
