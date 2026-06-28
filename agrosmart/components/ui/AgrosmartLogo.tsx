"use client";

interface AgrosmartLogoProps {
  variant?: "icon" | "wordmark";
  theme?: "dark" | "light";
  iconSize?: number;
  className?: string;
}

function AgrosmartIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="8" fill="#00C896" />
      <path d="M16 25.5V14.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 16.5C10.8 16.5 7.6 12.8 8.2 7.4C13.4 7.4 16.6 11.1 16 16.5Z" fill="#FFFFFF" />
      <path d="M16.4 18.8C21 18.8 23.8 15.4 23.2 10.6C18.6 10.9 15.8 14 16.4 18.8Z" fill="#FFFFFF" fillOpacity="0.82" />
    </svg>
  );
}

export function AgrosmartLogo({
  variant = "wordmark",
  theme = "dark",
  iconSize = 32,
  className = "",
}: AgrosmartLogoProps) {
  if (variant === "icon") {
    return (
      <span className={className} style={{ display: "inline-flex" }}>
        <AgrosmartIcon size={iconSize} />
      </span>
    );
  }

  const textColor = theme === "dark" ? "#f4f8f6" : "#0e1a16";
  const fontSize  = Math.round(iconSize * 0.69);
  const gapPx     = Math.round(iconSize * 0.28);

  return (
    <div className={`flex items-center select-none ${className}`} style={{ gap: gapPx }}>
      <AgrosmartIcon size={iconSize} />
      <span
        style={{
          fontSize,
          fontWeight: 600,
          color: textColor,
          letterSpacing: "-0.025em",
          lineHeight: 1,
          fontFamily: "inherit",
        }}
      >
        agrosmart
      </span>
    </div>
  );
}

export function agrosmartIconHtml(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="8" fill="#00C896"/>
  <path d="M16 25.5V14.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M16 16.5C10.8 16.5 7.6 12.8 8.2 7.4C13.4 7.4 16.6 11.1 16 16.5Z" fill="#FFFFFF"/>
  <path d="M16.4 18.8C21 18.8 23.8 15.4 23.2 10.6C18.6 10.9 15.8 14 16.4 18.8Z" fill="#FFFFFF" fill-opacity="0.82"/>
</svg>`;
}
