import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme/theme-preference";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgencyOS",
  description: "Hybrid agency CRM/PM with an AI agent workforce",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html lang="en" className="dark" suppressHydrationWarning>
    <head>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
    </head>
    <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {children}
      <ThemeToggle />
    </body>
  </html>
);

export default RootLayout;
