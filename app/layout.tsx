import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CourierOS",
  description: "Courier management platform",
};

// Runs before paint so dark mode + sidebar state apply without a flash.
// Also clears any leftover cos-brand entry from earlier color-picker experiments
// so the defaults from globals.css always win now.
const themeInitScript = `(function(){try{
var t=localStorage.getItem('theme');
if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
if(t==='dark')document.documentElement.classList.add('dark');
if(localStorage.getItem('sidebar-collapsed')==='1')document.documentElement.classList.add('sidebar-collapsed');
localStorage.removeItem('cos-brand');
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Inline script must run before paint, so we use a plain <script> tag
            with dangerouslySetInnerHTML. The Next 16 / React 19 dev overlay
            warns when a <Script> component is given JSX text children. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
