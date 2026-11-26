import type { Metadata, Viewport } from 'next'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/source-serif-4/700.css'
import './globals.css'
import { PWARegister } from '@/components/pwa-register'

export const metadata: Metadata = {
  title: {
    default: 'Sahayak — Secure Study Platform',
    template: '%s · Sahayak'
  },
  description:
    'Multi-school study platform for Class 10 & 12: grounded AI tutor over approved material, practice, assignments and progress — with a local AI model only.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E11D48'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-rose-600 focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}
