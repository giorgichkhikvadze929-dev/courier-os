import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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

// Runs before paint so the theme is applied without a flash.
// Reads three localStorage keys:
//   - 'theme'              — 'dark' | 'light'
//   - 'sidebar-collapsed'  — '1' if the sidebar is in compact mode
//   - 'cos-brand'          — JSON { primary, success, warning, danger } hex colors
//                            (any subset; only provided keys override defaults)
const themeInitScript = `(function(){try{
var t=localStorage.getItem('theme');
if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
if(t==='dark')document.documentElement.classList.add('dark');
if(localStorage.getItem('sidebar-collapsed')==='1')document.documentElement.classList.add('sidebar-collapsed');
var b=localStorage.getItem('cos-brand');
if(b){var c=JSON.parse(b);var r=document.documentElement;
  if(c.primary){r.style.setProperty('--color-primary',c.primary);r.style.setProperty('--color-primary-hover',c.primary);}
  if(c.success){r.style.setProperty('--color-success',c.success);}
  if(c.warning){r.style.setProperty('--color-warning',c.warning);}
  if(c.danger){r.style.setProperty('--color-danger',c.danger);}}
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
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
