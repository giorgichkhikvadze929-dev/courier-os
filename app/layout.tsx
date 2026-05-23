import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
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

/**
 * Theming is cookie-based, not script-based:
 *   - `theme` cookie  = 'dark' | 'light' — toggled by the moon/sun icon
 *   - `sidebar-collapsed` cookie = '1' — toggled by the sidebar arrow
 *
 * Reading them server-side and putting the classes straight on <html> means
 * there's no inline `<script>` in the tree (avoids the Next 16 / React 19 dev
 * overlay) and no flash of light theme on first paint.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ck = await cookies()
  const theme = ck.get('theme')?.value === 'dark' ? 'dark' : 'light'
  const sidebarCollapsed = ck.get('sidebar-collapsed')?.value === '1'

  const htmlClass = [
    geistSans.variable,
    geistMono.variable,
    'h-full antialiased',
    theme === 'dark' ? 'dark' : '',
    sidebarCollapsed ? 'sidebar-collapsed' : '',
  ].filter(Boolean).join(' ')

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
