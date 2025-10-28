import { useParams } from 'react-router'
import { Check, ExternalLink, Copy, Shield, Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useState, useEffect } from 'react'
import { createSolanaRpc, getBase58Encoder, type Address } from 'gill'

interface VerificationData {
  isVerified: boolean
  walletAddress: string
  timestamp: string
  socialLinks: string[]
  isPending: boolean // True if first transaction exists but no social links registered yet
  originalSignature: string // The first signature (from QR code)
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

        // Find the transaction that contains the first signature in memo
        let socialLinks: string[] = []

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
                  socialLinks = JSON.parse(parts[1])
                }
                break
              }
            } catch (e) {
              // Skip invalid instructions
              console.error('[VERIFICATION PAGE] Error parsing memo:', e)
              continue
            }
          }

          if (socialLinks.length > 0) break
        }

        setVerificationData({
          isVerified: true,
          walletAddress,
          timestamp: blockTime ? new Date(Number(blockTime) * 1000).toISOString() : new Date().toISOString(),
          socialLinks,
          isPending: socialLinks.length === 0, // Pending if no social links registered yet
          originalSignature: firstSignature // Store the first signature for display
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
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading verification data...</p>
        </div>
      </div>
    )
  }

  if (error || !verificationData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="bg-red-100 p-2 rounded-full">
                <span className="text-red-600 text-2xl">✗</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-red-600">Verification Failed</h2>
                <p className="text-sm text-muted-foreground">
                  {error || 'Could not verify this content'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/10 p-4 rounded-full">
              <Shield className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">Content Verification</h1>
          <p className="text-muted-foreground">
            Verify the authenticity and ownership of digital content
          </p>
        </div>

        {/* Verification Status */}
        <Card className="p-6">
          <div className="flex items-center justify-center space-x-3 mb-4">
            {verificationData.isPending ? (
              <>
                <div className="bg-yellow-100 p-2 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-yellow-600">Registration Pending</h2>
                  <p className="text-sm text-muted-foreground">
                    The owner of this content hasn't completed the verification procedure yet
                  </p>
                </div>
              </>
            ) : verificationData.isVerified ? (
              <>
                <div className="bg-green-100 p-2 rounded-full">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-green-600">Verified Content</h2>
                  <p className="text-sm text-muted-foreground">
                    This content has been cryptographically verified
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-red-100 p-2 rounded-full">
                  <span className="h-6 w-6 text-red-600">✗</span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-red-600">Unverified Content</h2>
                  <p className="text-sm text-muted-foreground">
                    This content could not be verified
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Signature Details */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Transaction Details</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Original Signature</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="bg-muted p-2 rounded text-sm flex-1 break-all">
                  {verificationData.originalSignature || "N/A"}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(verificationData.originalSignature || "")}
                >
                  {copied ? "Copied!" : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Wallet Address</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="bg-muted p-2 rounded text-sm break-all flex-1">
                  {verificationData.walletAddress}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(verificationData.walletAddress)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Signed On</label>
              <p className="text-sm mt-1">{formatDate(verificationData.timestamp)}</p>
            </div>
          </div>
        </Card>

        {/* Social Media Links */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Content Distribution</h3>
          {verificationData.socialLinks.length > 0 ? (
            <div className="space-y-3">
              {verificationData.socialLinks.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="font-medium">{extractPlatformFromUrl(url)}</span>
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                      Posted
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No social media posts registered for this content yet
            </p>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Powered by Deepreal • Content verification on Solana</p>
        </div>

      </div>
    </div>
  )
}