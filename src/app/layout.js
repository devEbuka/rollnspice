import { Anton, Inter } from "next/font/google";
import "./globals.css";
import CartDrawer from "@/components/cart/CartDrawer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

export const metadata = {
  title: "Roll N Spice — Fresh shawarma in Lagos",
  description: "Explore our flame-grilled shawarma, fresh wraps, sides, and house-made zobo.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}<CartDrawer /></body>
    </html>
  );
}
