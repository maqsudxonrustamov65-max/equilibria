import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Equilibria | Supply and demand simulator",
  description:
    "An interactive microeconomics simulator. Shift supply and demand, add taxes, subsidies and price controls, and see consumer surplus, producer surplus and deadweight loss update live.",
  applicationName: "Equilibria",
  openGraph: {
    title: "Equilibria",
    description: "Interactive supply and demand: taxes, subsidies, price controls, surplus and deadweight loss.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
