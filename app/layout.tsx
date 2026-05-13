import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/navbar'
import { ScaleInit, SCALE_INIT_SCRIPT } from '@/components/scale-init'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Floored',
  description: 'A roguelike casino survival game.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Runs before first paint to avoid layout flash on large monitors */}
        <script dangerouslySetInnerHTML={{ __html: SCALE_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.className} bg-background text-foreground h-screen flex flex-col`}>
        {/* Re-applies after hydration and keeps scale in sync on resize */}
        <ScaleInit />
        <Navbar />
        <main className="container mx-auto px-4 py-4 flex-1 min-h-0 flex flex-col overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
