import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Trade Journal",
  description: "Track and analyze your trading performance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto">
          <header className="p-4 border-b border-gray-800">
            <h1 className="text-2xl font-bold text-center md:text-left">Trade Journal</h1>
          </header>
          <Navigation />
          <main className="p-4">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
