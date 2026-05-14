import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { QueryProvider } from "@/lib/queryClient";
import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import AuthModal from "@/components/auth/AuthModal";
import QuickSearch from "@/components/layout/QuickSearch";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OMNISTREAM — Stream Anime, Movies & TV Shows",
  description:
    "Your premium streaming & manga hub. Watch anime, movies, TV shows and read manga — all in one place.",
  keywords: ["streaming", "anime", "movies", "tv shows", "manga", "omnistream"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-void text-white`}>
        <QueryProvider>
          <Suspense>
            <Topbar />
            <Sidebar />
          </Suspense>
          <main className="pb-16 md:pb-0 min-h-screen">
            {children}
          </main>
          <MobileNav />
          <AuthModal />
          <QuickSearch />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1e1e1e',
                color: '#fff',
                border: '1px solid #2a2a2a',
                borderRadius: '12px',
                fontSize: '14px',
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
