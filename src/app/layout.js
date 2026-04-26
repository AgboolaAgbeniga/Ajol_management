import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "AJOL Systematic Review Platform",
  description: "AJOL Systematic Review Platform for researchers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script 
          src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js" 
          strategy="beforeInteractive"
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
