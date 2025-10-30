export interface VerificationData {
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

export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
