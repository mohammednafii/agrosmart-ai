import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#00C896",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={23} height={23} viewBox="0 0 32 32" fill="none">
          <path d="M16 25.5V14.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M16 16.5C10.8 16.5 7.6 12.8 8.2 7.4C13.4 7.4 16.6 11.1 16 16.5Z" fill="white" />
          <path
            d="M16.4 18.8C21 18.8 23.8 15.4 23.2 10.6C18.6 10.9 15.8 14 16.4 18.8Z"
            fill="white"
            fillOpacity={0.82}
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
