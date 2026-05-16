import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClipForge | Turn Long Videos Into Viral Short-Form Content",
  description: "Upload a podcast, webinar, or stream. Get viral clips for TikTok, Reels, and Shorts in one click — powered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          {children}
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#261911',
                color: '#fff8f5',
                border: '1px solid #ab3500',
                borderRadius: '12px',
                fontWeight: 500,
              },
              success: {
                iconTheme: { primary: '#ab3500', secondary: '#fff' }
              }
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
