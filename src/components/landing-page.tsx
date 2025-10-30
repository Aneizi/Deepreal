import { useNavigate } from 'react-router'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { ThemeSelect } from '@/components/theme-select'
import { useEffect, useState } from 'react'

export default function LandingPage() {
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Determine which logo to use based on theme
  const logoSrc = mounted && resolvedTheme === 'dark'
    ? '/logotype-darkmode-transparent@2x.png'
    : '/logotype-lightmode-transparent@2x.png'

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative">
      {/* Theme selector in top-right corner */}
      <div className="absolute top-4 right-4">
        <ThemeSelect />
      </div>

      <div className="flex flex-col items-center gap-12 max-w-md w-full">
        {/* Logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full animate-pulse" />
          <img
            src={logoSrc}
            alt="Deepreal Logo"
            className="relative h-32 w-auto object-contain"
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-4 w-full">
          <Button
            size="lg"
            className="w-full text-base font-semibold"
            onClick={() => navigate('/stamp')}
          >
            Enter App
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full text-base font-semibold"
            onClick={() => navigate('/verify')}
          >
            Verify
          </Button>
        </div>

        {/* Tagline */}
        <p className="text-sm text-muted-foreground text-center">
          Content verification on Solana
        </p>
      </div>
    </div>
  )
}
