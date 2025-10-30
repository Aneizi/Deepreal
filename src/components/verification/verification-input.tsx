import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Shield } from 'lucide-react'

export default function VerificationInput() {
  const [signature, setSignature] = useState('')
  const navigate = useNavigate()

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (signature.trim()) {
      navigate(`/verify/${signature.trim()}`)
    }
  }

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
              <div className="relative bg-background border-2 border-primary/20 p-5 rounded-full">
                <Shield className="h-10 w-10 text-primary" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Verify Content</h1>
            <p className="text-muted-foreground">
              Enter a transaction signature to verify content on Solana
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="signature" className="text-sm font-medium">
              Transaction Signature
            </label>
            <Input
              id="signature"
              type="text"
              placeholder="Enter transaction signature..."
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!signature.trim()}
          >
            Verify
          </Button>
        </form>

        {/* Back button */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  )
}
