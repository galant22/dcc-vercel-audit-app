import "./style.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DCC Vercel Audit App",
  description: "Simple DCC input with Google login and Google Sheets audit trail"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
