import { createSolanaRpc, getBase58Encoder, type Address } from 'gill'
import { type VerificationData, MEMO_PROGRAM_ID } from './types'

/**
 * Fetches and verifies content registration data from Solana blockchain
 * @param signature - Transaction signature from QR code
 * @returns VerificationData or throws error
 */
export async function fetchVerificationData(signature: string): Promise<VerificationData> {
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

  return {
    isVerified: true,
    walletAddress,
    timestamp: blockTime ? new Date(Number(blockTime) * 1000).toISOString() : new Date().toISOString(),
    socialLinks,
    isPending: socialLinks.length === 0, // Pending if no social links registered yet
    originalSignature: firstSignature, // Store the first signature for display
    allRegistrations // Store all registrations for display
  }
}
