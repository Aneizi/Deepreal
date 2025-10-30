import React, { useCallback, useRef, useState } from 'react'
import { Upload, Plus, X, Check, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSolana } from '@/components/solana/use-solana.tsx'
import {
  createTransaction,
  signAndSendTransactionMessageWithSigners,
  getBase58Decoder,
  type Address
} from 'gill'
import { getAddMemoInstruction } from 'gill/programs'
import { useWalletUiSigner } from '@wallet-ui/react'
import { generateQrCanvas } from './qr-generator'
import { processVideoWithQr } from './video-processor'
import { validateFile } from './file-validator'
import { type AcceptedFile, PLATFORM_PLACEHOLDERS, STEPS } from './types'

const steps = STEPS

export default function Dropzone() {
  const solana = useSolana()
  const account = solana.account

  // Check if account exists before trying to use it
  if (!account) {
    return <DropzoneNoWallet />
  }

  return <DropzoneWithWallet account={account} />
}

function DropzoneNoWallet() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <p className="text-muted-foreground">Please connect your wallet to continue</p>
    </div>
  )
}

function DropzoneWithWallet({ account }: { account: any }) {
  const solana = useSolana()
  const address = account?.address as Address
  const signer = useWalletUiSigner({ account })


  const [file, setFile] = useState<AcceptedFile>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [processedImage, setProcessedImage] = useState<string>('')
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string>('')
  const [processedVideoName, setProcessedVideoName] = useState<string>('')
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>('')
  const [postLinks, setPostLinks] = useState<string[]>([''])
  const [firstSignature, setFirstSignature] = useState<string>('')
  const [secondSignature, setSecondSignature] = useState<string>('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Preload logo on mount
  React.useEffect(() => {
    const logo = new Image()
    logo.src = '/favicon.ico'
    logoRef.current = logo
  }, [])


  const handleStepClick = useCallback((step: number) => {
    setCurrentStep(step)
    if (step === 1) {
      // Reset to step 1 - clear processed image and abort any processing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setProcessedImage('')
      setProcessedVideoUrl('')
      setLoading(false)
      setLoadingMessage('')
    }
  }, [])

  // Functions to handle post links
  const addPostLink = useCallback(() => {
    setPostLinks(prev => [...prev, ''])
  }, [])

  const updatePostLink = useCallback((index: number, value: string) => {
    setPostLinks(prev => prev.map((link, i) => i === index ? value : link))
  }, [])

  const removePostLink = useCallback((index: number) => {
    if (postLinks.length > 1) {
      setPostLinks(prev => prev.filter((_, i) => i !== index))
    }
  }, [postLinks.length])

  // Generate stamped filename from original file
  const getStampedFilename = useCallback(() => {
    if (!file) return 'content_stamped'

    const originalName = file.name
    const lastDotIndex = originalName.lastIndexOf('.')

    if (lastDotIndex === -1) {
      // No extension found
      return `${originalName}_stamped`
    }

    const nameWithoutExt = originalName.substring(0, lastDotIndex)
    const extension = originalName.substring(lastDotIndex)

    return `${nameWithoutExt}_stamped${extension}`
  }, [file])

  // Unified handler for both images and videos
  const overlayQRCodeOnImage = useCallback(async () => {
    if (!file) return
    if (!signer || !address) return

    // Create new abort controller for this processing
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    try {
      // Step 1: Sign transaction with memo
      setLoadingMessage('Signing transaction...')

      if (abortController.signal.aborted) {
        throw new Error('Processing cancelled')
      }

      const rpc = solana.client.rpc
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      if (abortController.signal.aborted) {
        throw new Error('Processing cancelled')
      }

      const memoIx = getAddMemoInstruction({
        memo: "[Deepreal] Signature Generated"
      })

      const transaction = createTransaction({
        version: 'legacy',
        feePayer: signer,
        instructions: [memoIx],
        latestBlockhash: latestBlockhash,
      })

      const txSignature = await signAndSendTransactionMessageWithSigners(transaction)
      const signatureString = getBase58Decoder().decode(txSignature)

      if (abortController.signal.aborted) {
        throw new Error('Processing cancelled')
      }

      // Store the first signature for use in step 3
      setFirstSignature(signatureString)

      // Step 2: Generate QR code linking to verification page
      setLoadingMessage('Generating QR code...')
      const verifyLink = `https://usedeepreal.com/verify/${signatureString}`
      const qrCanvas = await generateQrCanvas(verifyLink, logoRef.current || undefined)

      if (abortController.signal.aborted) {
        throw new Error('Processing cancelled')
      }

      // Branch by file type
      if (file.type.startsWith('image/')) {
        // Existing image path
        setLoadingMessage('Processing image...')
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const img = new Image()
        const imageUrl = URL.createObjectURL(file)
        await new Promise<void>((resolve, reject) => {
          if (abortController.signal.aborted) {
            reject(new Error('Processing cancelled'))
            return
          }
          img.onload = () => resolve()
          img.onerror = reject
          abortController.signal.addEventListener('abort', () => {
            URL.revokeObjectURL(imageUrl)
            reject(new Error('Processing cancelled'))
          })
          img.src = imageUrl
        })

        if (abortController.signal.aborted) {
          URL.revokeObjectURL(imageUrl)
          throw new Error('Processing cancelled')
        }

        canvas.width = img.width
        canvas.height = img.height

        ctx.drawImage(img, 0, 0)

        const qrSize = Math.min(img.width, img.height) * 0.2
        const qrX = 20
        const qrY = img.height - qrSize - 20

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20)
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

        URL.revokeObjectURL(imageUrl)

        const processedDataUrl = canvas.toDataURL('image/png')
        setProcessedImage(processedDataUrl)
        setProcessedVideoUrl('')
        setCurrentStep(2)
      } else if (file.type.startsWith('video/')) {
        setLoadingMessage('Processing video...')
        const url = await processVideoWithQr(file, qrCanvas, abortController.signal)
        // Infer preferred extension again for naming based on recorder support
        const preferred = ['video/mp4;codecs=h264','video/mp4','video/quicktime;codecs=h264','video/quicktime']
        const chosen = preferred.find(t => MediaRecorder.isTypeSupported(t)) || ''
        const ext = chosen.includes('quicktime') ? 'mov' : (chosen.includes('mp4') ? 'mp4' : 'webm')
        setProcessedVideoUrl(url)
        setProcessedVideoName(`video-with-qr.${ext}`)
        setProcessedImage('')
        setCurrentStep(2)
      } else {
        alert('Unsupported file type. Please use PNG, JPG, or a common video format like MP4/WebM.')
      }

    } catch (error) {
      // Don't show error if processing was cancelled
      if (error instanceof Error && error.message === 'Processing cancelled') {
        console.log('Processing cancelled by user')
      } else {
        console.error('Failed to overlay QR code:', error)
        alert('Failed to create watermark. Please try again with a different file.')
      }
    } finally {
      setLoading(false)
      setLoadingMessage('')
      abortControllerRef.current = null
    }
  }, [file, signer, address, solana.client.rpc])

  // Function to submit post links to Solana
  const submitPostLinks = useCallback(async () => {
    if (!signer || !address) return
    if (!firstSignature) {
      console.error('First signature not found')
      return
    }

    // Filter out empty links
    const validLinks = postLinks.filter(link => link.trim() !== '')
    if (validLinks.length === 0) {
      alert('Please add at least one post link')
      return
    }

    setLoading(true)
    try {
      const rpc = solana.client.rpc
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      // Create memo with standardized format: [Deepreal] {firstSignature} | {JSON.stringify(links)}
      const linksData = JSON.stringify(validLinks)
      const memo = `[Deepreal] ${firstSignature} | ${linksData}`

      console.log('Submitting memo:', memo)

      const memoIx = getAddMemoInstruction({
        memo: memo
      })

      const transaction = createTransaction({
        version: 'legacy',
        feePayer: signer,
        instructions: [memoIx],
        latestBlockhash: latestBlockhash,
      })

      const txSignature = await signAndSendTransactionMessageWithSigners(transaction)
      const signatureString = getBase58Decoder().decode(txSignature)

      console.log('Post links transaction signed:', signatureString)

      // Store the second signature
      setSecondSignature(signatureString)

    } catch (error) {
      console.error('Failed to submit post links:', error)
      alert('Failed to submit post links. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [signer, address, firstSignature, postLinks, solana.client.rpc])

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const f = files[0]
    const result = await validateFile(f)

    if (!result.isValid) {
      alert(result.error || 'Invalid file')
      return
    }

    setFile(f)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // Don't allow file drop while processing
    if (loading) return
    onFiles(e.dataTransfer.files)
  }, [onFiles, loading])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // Don't show drag state while processing
    if (loading) return
    setIsDragging(true)
  }, [loading])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onClick = useCallback(() => {
    // Don't allow file selection while processing
    if (loading) return
    inputRef.current?.click()
  }, [loading])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files)
  }, [onFiles])

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <div className="max-w-3xl mx-auto px-4 pt-8 pb-12">
          {/* Elegant Progress Indicator */}
          <div className="mb-12">
            <div className="flex items-start justify-between max-w-2xl mx-auto">
              {steps.map((step, index) => {
                const stepNumber = index + 1
                const isCompleted = stepNumber < currentStep
                const isCurrent = stepNumber === currentStep
                const isClickable = isCompleted && handleStepClick

                return (
                  <React.Fragment key={index}>
                    <div
                      className={`flex-1 flex flex-col items-center transition-all duration-300 ${
                        isClickable ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => isClickable && handleStepClick(stepNumber)}
                    >
                      <div
                        className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110'
                            : isCompleted
                            ? 'bg-primary/10 text-primary ring-2 ring-primary/20'
                            : 'bg-muted/50 text-muted-foreground'
                        } ${isClickable ? 'hover:scale-105' : ''}`}
                      >
                        {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
                      </div>
                      <div
                        className={`mt-2 text-xs font-medium transition-all duration-300 text-center px-1 ${
                          isCurrent ? 'text-foreground opacity-100' : 'text-muted-foreground opacity-60'
                        }`}
                      >
                        <span className="hidden sm:inline">{step.title}</span>
                        <span className="sm:hidden">{step.title.split(' ')[0]}</span>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="flex items-start pt-[1.25rem] sm:pt-[1.375rem] flex-shrink-0 px-2 sm:px-4">
                        <div
                          className={`h-0.5 w-8 sm:w-16 transition-all duration-500 ${
                            isCompleted ? 'bg-primary' : 'bg-muted/30'
                          }`}
                        />
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="space-y-8">
          {currentStep === 1 && (
            <>
              {/* Header */}
              <div className="text-center space-y-3 mb-8">
                <h1 className="text-3xl font-semibold tracking-tight">Upload your content</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  Deepreal will create a signed proof of authorship and prepare a QR watermark that links back to your verified record on Solana.
                </p>
              </div>

              {/* Upload Zone */}
              <div className="relative">
                {file && (
                  <button
                    className="absolute -top-3 -right-3 z-20 h-9 w-9 rounded-full bg-background shadow-lg border border-border hover:bg-muted transition-all duration-200 flex items-center justify-center group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                        abortControllerRef.current = null;
                      }
                      if (inputRef.current) {
                        inputRef.current.value = '';
                      }
                      setFile(null);
                      setProcessedImage('');
                      setProcessedVideoUrl('');
                      setCurrentStep(1);
                      setLoading(false);
                      setLoadingMessage('');
                    }}
                  >
                    <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                )}

                <div
                  className={`relative rounded-2xl transition-all duration-300 overflow-hidden ${
                    isDragging
                      ? 'ring-2 ring-primary ring-offset-4 ring-offset-background shadow-2xl shadow-primary/20 scale-[1.02]'
                      : 'ring-1 ring-border shadow-sm hover:shadow-md'
                  } ${loading ? 'cursor-not-allowed' : 'cursor-pointer'} backdrop-blur-sm bg-card/50`}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={onClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
                >
                  {!file ? (
                    <div className="flex flex-col items-center justify-center gap-6 p-16 min-h-[400px]">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                        <div className="relative rounded-full bg-gradient-to-br from-primary/10 to-primary/5 p-6 ring-1 ring-primary/10">
                          <Upload className="h-12 w-12 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-3 text-center">
                        <p className="text-lg font-medium">Drop your file here</p>
                        <p className="text-sm text-muted-foreground">or click to browse</p>
                        <p className="text-xs text-muted-foreground/70">
                          Supports PNG, JPG, MP4, MOV, WebM, or MKV
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 min-h-[400px] flex items-center justify-center">
                      <div className="flex flex-col items-center gap-6 max-w-full">
                        <div className="relative group">
                          {file.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="max-h-[280px] max-w-full rounded-xl shadow-lg ring-1 ring-border object-contain"
                            />
                          ) : (
                            <>
                              <video
                                src={URL.createObjectURL(file)}
                                controls={!loading}
                                preload="metadata"
                                className="max-h-[280px] max-w-full rounded-xl shadow-lg ring-1 ring-border object-contain"
                              />
                              {loading && (
                                <div className="absolute inset-0 bg-transparent" style={{ pointerEvents: 'none' }} />
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-2 text-center">
                          <p className="text-sm font-medium truncate max-w-md">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png, image/jpeg, video/mp4, video/webm, video/quicktime"
                    className="hidden"
                    onChange={onInputChange}
                  />
                </div>
              </div>

              {/* Action Button */}
              {file && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={overlayQRCodeOnImage}
                    disabled={!file || !signer || !address || loading}
                    size="lg"
                    className="px-8 h-12 text-base font-medium rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span>{loadingMessage}</span>
                      </>
                    ) : (
                      'Generate watermark'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

            {currentStep === 2 && (processedImage || processedVideoUrl) && (
              <>
                {/* Header */}
                <div className="text-center space-y-3 mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 ring-1 ring-green-500/20 mb-4">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-500" />
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight">Your content is ready</h1>
                  <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Your media is now stamped with a QR code that proves it was vouched for by you. Download this watermarked version and share it anywhere.
                  </p>
                </div>

                {/* Preview */}
                <div className="relative rounded-2xl overflow-hidden ring-1 ring-border shadow-lg backdrop-blur-sm bg-card/50">
                  <div className="p-8 min-h-[400px] flex items-center justify-center bg-gradient-to-br from-muted/30 to-transparent">
                    {processedImage ? (
                      <img
                        src={processedImage}
                        alt="Watermarked content"
                        className="max-h-[350px] max-w-full object-contain rounded-xl shadow-2xl ring-1 ring-border/50"
                      />
                    ) : processedVideoUrl ? (
                      <video
                        src={processedVideoUrl}
                        controls
                        className="max-h-[350px] max-w-full object-contain rounded-xl shadow-2xl ring-1 ring-border/50"
                      />
                    ) : null}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                  <Button
                    asChild
                    size="lg"
                    className="px-8 h-12 text-base font-medium rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
                  >
                    <a
                      href={processedImage || processedVideoUrl}
                      download={getStampedFilename()}
                    >
                      Download file
                    </a>
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(3)}
                    variant="outline"
                    size="lg"
                    className="px-8 h-12 text-base font-medium rounded-xl"
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                {/* Header */}
                <div className="text-center space-y-3 mb-8">
                  <h1 className="text-3xl font-semibold tracking-tight">Share your content</h1>
                  <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Post your watermarked content on any platform. Then paste the link back here so Deepreal can anchor your proof on Solana and make your authorship verifiable forever.
                  </p>
                </div>

                {/* Form */}
                <div className="relative rounded-2xl overflow-hidden ring-1 ring-border backdrop-blur-sm bg-card/50 p-8">
                  {processedVideoUrl && (
                    <div className="mb-6 px-4 py-2 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-xs text-muted-foreground">
                        Video format: {processedVideoName?.split('.').pop()?.toUpperCase() || 'WEBM'} (browser-dependent)
                      </p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {postLinks.map((link, index) => (
                      <div key={index} className="space-y-2.5">
                        <label className="text-sm font-medium text-foreground/90">
                          Post Link {index + 1}
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="url"
                            placeholder={PLATFORM_PLACEHOLDERS[index % PLATFORM_PLACEHOLDERS.length]}
                            value={link}
                            onChange={(e) => updatePostLink(index, e.target.value)}
                            disabled={!!secondSignature}
                            className="flex-1 h-11 rounded-xl border-border/50 bg-background/50 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                          {postLinks.length > 1 && !secondSignature && (
                            <button
                              onClick={() => removePostLink(index)}
                              className="h-11 w-11 rounded-xl border border-border/50 bg-background/50 hover:bg-muted/50 transition-colors flex items-center justify-center group"
                            >
                              <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {!secondSignature && (
                      <button
                        onClick={addPostLink}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Add another link
                      </button>
                    )}
                  </div>
                </div>

                {/* Submit Button - Only show if not registered */}
                {!secondSignature && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={submitPostLinks}
                      disabled={postLinks.every(link => !link.trim()) || loading}
                      size="lg"
                      className="px-8 h-12 text-base font-medium rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Registering on Solana...
                        </>
                      ) : (
                        'Register on Solana'
                      )}
                    </Button>
                  </div>
                )}

                {/* Success State */}
                {secondSignature && (
                  <>
                    <div className="relative rounded-2xl overflow-hidden ring-1 ring-green-500/20 backdrop-blur-sm bg-gradient-to-br from-green-500/5 to-emerald-500/5 p-8 mt-8">
                      <div className="space-y-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/10 ring-1 ring-green-500/20 flex items-center justify-center">
                            <Check className="w-6 h-6 text-green-600 dark:text-green-500" />
                          </div>
                          <div className="flex-1 pt-1">
                            <h3 className="text-lg font-semibold mb-1">Registration Complete!</h3>
                            <p className="text-sm text-muted-foreground">
                              Your content has been successfully registered on Solana
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Watermark Signature
                            </label>
                            <code className="block bg-background/80 backdrop-blur-sm px-4 py-3 rounded-lg text-xs font-mono border border-border/50 break-all">
                              {firstSignature}
                            </code>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Registration Signature
                            </label>
                            <code className="block bg-background/80 backdrop-blur-sm px-4 py-3 rounded-lg text-xs font-mono border border-border/50 break-all">
                              {secondSignature}
                            </code>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="rounded-lg"
                            >
                              <a
                                href={`https://explorer.solana.com/tx/${secondSignature}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View on Solana Explorer
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              asChild
                              className="rounded-lg"
                            >
                              <a
                                href={`/verify/${firstSignature}`}
                                className="inline-flex items-center gap-2"
                              >
                                <Check className="h-4 w-4" />
                                View Verification Page
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stamp Other Content Button */}
                    <div className="flex justify-center pt-8">
                      <Button
                        onClick={() => {
                          // Reset everything to start over
                          if (abortControllerRef.current) {
                            abortControllerRef.current.abort();
                            abortControllerRef.current = null;
                          }
                          if (inputRef.current) {
                            inputRef.current.value = '';
                          }
                          setFile(null);
                          setProcessedImage('');
                          setProcessedVideoUrl('');
                          setCurrentStep(1);
                          setLoading(false);
                          setLoadingMessage('');
                          setFirstSignature('');
                          setSecondSignature('');
                          setPostLinks(['']);
                        }}
                        variant="outline"
                        size="lg"
                        className="px-8 h-12 text-base font-medium rounded-xl"
                      >
                        Stamp other content
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}