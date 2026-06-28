import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "AgroSmart — AI Hydro-Climatic Intelligence for Souss-Massa",
  description:
    "Predict soil water stress in the Souss-Massa region using a trained U-Net deep learning model fusing Sentinel-2, Landsat 8, CHIRPS and ERA5-Land data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={geist.variable}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
