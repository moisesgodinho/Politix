import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";

import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "Politix | Transparencia municipal em MG",
  description:
    "MVP para monitorar licitacoes municipais em Minas Gerais com dados ao vivo do IBGE, PNCP e BrasilAPI."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="pt-BR">
      <body className={`${sans.variable} ${display.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
