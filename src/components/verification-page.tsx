import { useParams } from 'react-router'
import { Check, ExternalLink, Copy, Shield, Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState, useEffect } from 'react'
import { createSolanaRpc, getBase58Encoder, type Address } from 'gill'

interface VerificationData {
  isVerified: boolean
  walletAddress: string
  timestamp: string
  socialLinks: string[]
  isPending: boolean // True if first transaction exists but no social links registered yet
  originalSignature: string // The first signature (from QR code)
  allRegistrations: Array<{
    signature: string
    timestamp: string
    links: string[]
  }> // All second signatures found for this content
}

export default function VerificationPage() {
  const { signature } = useParams<{ signature: string }>()
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch transaction data from Solana
  useEffect(() => {
    async function fetchVerificationData() {
      if (!signature) return

      setLoading(true)
      setError(null)

      try {
        // Create standalone RPC client for devnet (no wallet required)
        const rpc = createSolanaRpc('https://api.devnet.solana.com')

        // Get the transaction to verify it exists and get the wallet address
        console.log('[VERIFICATION PAGE] Signature from URL:', signature)
        const txResponse = await rpc.getTransaction(signature as any).send()

        if (!txResponse) {
          throw new Error('Transaction not found')
        }

        // Extract wallet address (fee payer) and block time
        const walletAddress = txResponse.transaction.message.accountKeys[0] as Address
        const blockTime = txResponse.blockTime

        console.log('[VERIFICATION PAGE] Wallet address:', walletAddress)
        console.log('[VERIFICATION PAGE] Transaction block time:', blockTime)

        // Check if this signature is actually the SECOND transaction (contains another signature in memo)
        let firstSignature = signature
        const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

        const instructions = txResponse.transaction.message.instructions
        const accountKeys = txResponse.transaction.message.accountKeys

        for (const instruction of instructions) {
          const programId = accountKeys[instruction.programIdIndex as number]
          if (programId !== MEMO_PROGRAM_ID) continue

          try {
            // Decode memo instruction
            const dataBytes = getBase58Encoder().encode(instruction.data)
            const decoder = new TextDecoder()
            const memoText = decoder.decode(dataBytes)

            console.log('[VERIFICATION PAGE] Found memo in provided signature:', memoText)

            // Check if this memo contains a first signature (format: [Deepreal] {firstSig} | ...)
            if (memoText.startsWith('[Deepreal] ') && memoText.includes(' | ')) {
              const parts = memoText.split(' | ')
              const extractedSig = parts[0].replace('[Deepreal] ', '').trim()

              // If we found a signature in the memo, this is the second transaction
              if (extractedSig && extractedSig !== signature) {
                console.log('[VERIFICATION PAGE] Detected second signature, extracting first:', extractedSig)
                firstSignature = extractedSig
                break
              }
            }
          } catch (e) {
            console.error('[VERIFICATION PAGE] Error parsing memo:', e)
            continue
          }
        }

        console.log('[VERIFICATION PAGE] Using first signature for search:', firstSignature)

        // Only fetch signatures that came AFTER the first transaction
        // Using 'until' parameter to stop at the first signature (exclusive)
        const signaturesResponse = await rpc.getSignaturesForAddress(walletAddress, {
          until: firstSignature as any,
          limit: 100
        }).send()

        console.log('[VERIFICATION PAGE] Fetching signatures after first tx:', signaturesResponse.length, 'transactions')

        // Find ALL transactions that contain the first signature in memo
        const allRegistrations: Array<{ signature: string; timestamp: string; links: string[] }> = []

        for (const sig of signaturesResponse) {
          const txData = await rpc.getTransaction(sig.signature).send()

          if (!txData) continue

          // Check if transaction has memo instruction
          const txInstructions = txData.transaction.message.instructions
          const txAccountKeys = txData.transaction.message.accountKeys

          for (const instruction of txInstructions) {
            // Check if this is a memo instruction
            const programId = txAccountKeys[instruction.programIdIndex as number]
            if (programId !== MEMO_PROGRAM_ID) continue

            try {
              // Decode base58 instruction data to bytes, then to UTF-8 string
              const dataBytes = getBase58Encoder().encode(instruction.data)
              const decoder = new TextDecoder()
              const memoText = decoder.decode(dataBytes)

              console.log('[VERIFICATION PAGE] Found memo:', memoText)

              // Check if memo contains our first signature
              // Format: [Deepreal] {firstSignature} | {JSON.stringify(links)}
              if (memoText.includes(`[Deepreal] ${firstSignature}`)) {
                // Extract links from memo
                const parts = memoText.split(' | ')
                if (parts.length > 1) {
                  const links = JSON.parse(parts[1])
                  const txBlockTime = txData.blockTime

                  allRegistrations.push({
                    signature: sig.signature as string,
                    timestamp: txBlockTime ? new Date(Number(txBlockTime) * 1000).toISOString() : new Date().toISOString(),
                    links
                  })

                  console.log('[VERIFICATION PAGE] Found registration:', { signature: sig.signature, links })
                }
                break
              }
            } catch (e) {
              // Skip invalid instructions
              console.error('[VERIFICATION PAGE] Error parsing memo:', e)
              continue
            }
          }
        }

        console.log('[VERIFICATION PAGE] Total registrations found:', allRegistrations.length)

        // Use the most recent registration (first in the array since results are sorted newest first)
        const socialLinks = allRegistrations.length > 0 ? allRegistrations[0].links : []

        setVerificationData({
          isVerified: true,
          walletAddress,
          timestamp: blockTime ? new Date(Number(blockTime) * 1000).toISOString() : new Date().toISOString(),
          socialLinks,
          isPending: socialLinks.length === 0, // Pending if no social links registered yet
          originalSignature: firstSignature, // Store the first signature for display
          allRegistrations // Store all registrations for display
        })
      } catch (err) {
        console.error('Error fetching verification data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch verification data')
      } finally {
        setLoading(false)
      }
    }

    fetchVerificationData()
  }, [signature])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const extractPlatformFromUrl = (url: string): string => {
    try {
      const hostname = new URL(url).hostname
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'X (Twitter)'
      if (hostname.includes('instagram')) return 'Instagram'
      if (hostname.includes('facebook')) return 'Facebook'
      if (hostname.includes('tiktok')) return 'TikTok'
      if (hostname.includes('linkedin')) return 'LinkedIn'
      if (hostname.includes('youtube')) return 'YouTube'
      if (hostname.includes('snapchat')) return 'Snapchat'
      if (hostname.includes('threads')) return 'Threads'
      return hostname
    } catch {
      return 'Unknown Platform'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
            <Loader2 className="relative h-12 w-12 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Loading verification data...</p>
        </div>
      </div>
    )
  }

  if (error || !verificationData) {
    return (
      <div className="min-h-screen w-full bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
                <div className="relative bg-background border-2 border-red-200 p-5 rounded-full">
                  <span className="text-3xl text-red-600">✗</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-red-600">Verification Failed</h2>
              <p className="text-muted-foreground">
                {error || 'Could not verify this content'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">

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
            <h1 className="text-4xl font-bold tracking-tight">Content Verification</h1>
            <p className="text-muted-foreground text-lg">
              Verify authenticity and ownership on Solana
            </p>
          </div>
        </div>

        {/* Verification Status */}
        <div className="relative">
          <div className="flex items-center justify-center py-8">
            {verificationData.isPending ? (
              <div className="flex items-center gap-4 px-6 py-4 rounded-full border-2 border-yellow-300 bg-yellow-50">
                <Clock className="h-6 w-6 text-yellow-700" />
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-yellow-900">Registration Pending</h2>
                  <p className="text-sm text-yellow-800">
                    Verification procedure not completed yet
                  </p>
                </div>
              </div>
            ) : verificationData.isVerified ? (
              <div className="relative group">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 rounded-full opacity-30 blur-xl group-hover:opacity-50 transition-opacity duration-500" />

                {/* Glass container */}
                <div className="relative flex items-center gap-4 px-8 py-5 rounded-full overflow-hidden backdrop-blur-xl bg-gradient-to-br from-white/40 via-white/30 to-white/20 border border-white/30 shadow-2xl">
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                  {/* Glass reflection overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-50" />

                  {/* Icon with glass effect */}
                  <div className="relative z-10 bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-full shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full" />
                    <Check className="relative h-5 w-5 text-white drop-shadow-sm" />
                  </div>

                  {/* Text content */}
                  <div className="relative z-10 text-left">
                    <h2 className="text-lg font-semibold text-gray-900 drop-shadow-sm">Verified Content</h2>
                    <p className="text-sm text-gray-700/90">
                      Cryptographically verified on Solana
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 px-6 py-4 rounded-full border-2 border-red-300 bg-red-50">
                <span className="h-6 w-6 text-red-700 text-xl font-bold">✗</span>
                <div className="text-left">
                  <h2 className="text-lg font-semibold text-red-900">Unverified Content</h2>
                  <p className="text-sm text-red-800">
                    Could not verify this content
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transaction Details */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">Transaction Details</h3>
          <div className="space-y-5">
            <div className="group">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Original Signature</label>
              <div className="flex items-center gap-2 mt-2 p-3 bg-muted/30 rounded-lg border border-transparent group-hover:border-muted-foreground/20 transition-colors">
                <code className="text-sm flex-1 break-all font-mono">
                  {verificationData.originalSignature || "N/A"}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyToClipboard(verificationData.originalSignature || "")}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="group">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Wallet Address</label>
              <div className="flex items-center gap-2 mt-2 p-3 bg-muted/30 rounded-lg border border-transparent group-hover:border-muted-foreground/20 transition-colors">
                <code className="text-sm flex-1 break-all font-mono">
                  {verificationData.walletAddress}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => copyToClipboard(verificationData.walletAddress)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Timestamp</label>
              <p className="text-sm mt-2 p-3 bg-muted/30 rounded-lg">{formatDate(verificationData.timestamp)}</p>
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">Content Distribution</h3>
          {verificationData.socialLinks.length > 0 ? (
            <div className="space-y-3">
              {verificationData.socialLinks.map((url, index) => (
                <div
                  key={index}
                  className="group flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-transparent hover:border-muted-foreground/20 hover:bg-muted/50 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="font-medium truncate">{extractPlatformFromUrl(url)}</span>
                    <span className="text-xs bg-green-500/10 text-green-700 px-2 py-0.5 rounded-full shrink-0">
                      Posted
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 ml-2"
                    asChild
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">View</span>
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No social media posts registered yet</p>
            </div>
          )}
        </div>

        {/* Multiple Registrations (Subtle) */}
        {verificationData.allRegistrations.length > 1 && (
          <div className="pt-6 border-t border-muted-foreground/10">
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none py-3 px-4 rounded-lg hover:bg-muted/20 transition-colors">
                <span className="text-sm font-medium text-muted-foreground">
                  Update History ({verificationData.allRegistrations.length} registrations)
                </span>
                <svg
                  className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-3 space-y-3 px-4 pb-2">
                <p className="text-xs text-muted-foreground">
                  This content has been registered multiple times. Showing the most recent above.
                </p>
                {verificationData.allRegistrations.map((reg, index) => (
                  <div
                    key={reg.signature}
                    className="border-l-2 border-muted-foreground/20 pl-4 py-3 space-y-2 hover:border-muted-foreground/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="text-xs font-medium">
                        #{index + 1}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(reg.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <code className="text-xs bg-muted/40 p-2 rounded block break-all font-mono">
                      {reg.signature}
                    </code>
                    <ul className="text-xs space-y-1">
                      {reg.links.map((link, linkIndex) => (
                        <li key={linkIndex} className="truncate">
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            title={link}
                          >
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-12 pb-6">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-medium">Deepreal</span> • Content verification on Solana
          </p>
        </div>

      </div>
    </div>
  )
}
