import { useParams } from 'react-router'
import { Check, ExternalLink, Copy, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useState } from 'react'

export default function VerificationPage() {
  const { signature } = useParams<{ signature: string }>()
  const [copied, setCopied] = useState(false)

  // Mock data - replace with actual API calls later
  const mockData = {
    isVerified: true,
    walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    timestamp: "2025-10-25T14:30:00Z",
    contentHash: "QmX8j9Ks2vN3mR4pL6wZ8bC5nQ7yT1xF9eA2uI0oP3sD6h",
    socialLinks: [
      {
        platform: "Twitter",
        url: "https://twitter.com/user/status/123456789",
        posted: true
      },
      {
        platform: "Instagram", 
        url: "https://instagram.com/p/ABC123DEF",
        posted: true
      },
      {
        platform: "TikTok",
        url: "https://tiktok.com/@user/video/123456789",
        posted: false
      }
    ]
  }

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

  // Filter only posted links
  const postedLinks = mockData.socialLinks.filter(link => link.posted)

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
            {mockData.isVerified ? (
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
              <label className="text-sm font-medium text-muted-foreground">Signature</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="bg-muted p-2 rounded text-sm flex-1 break-all">
                  {signature || "N/A"}
                </code>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(signature || "")}
                >
                  {copied ? "Copied!" : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Wallet Address</label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="bg-muted p-2 rounded text-sm break-all flex-1">
                  {mockData.walletAddress}
                </code>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(mockData.walletAddress)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Signed On</label>
              <p className="text-sm mt-1">{formatDate(mockData.timestamp)}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Content Hash</label>
              <code className="bg-muted p-2 rounded text-sm block mt-1 break-all">
                {mockData.contentHash}
              </code>
            </div>
          </div>
        </Card>

        {/* Social Media Links */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Content Distribution</h3>
          {postedLinks.length > 0 ? (
            <div className="space-y-3">
              {postedLinks.map((link, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="font-medium">{link.platform}</span>
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                      Posted
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No social media posts found for this content
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