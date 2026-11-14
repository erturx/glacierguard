import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "glacierguard · Kyrgyzstan glacier lake observatory",
  description: "Explore real NASA–ISRO NISAR radar imagery and measurement quality in Kyrgyzstan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
