import React, { useCallback, useRef, useState } from 'react'
import { Upload, Trash2, Plus, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Stepper } from '@/components/ui/stepper'
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
      <div className="min-h-screen flex flex-col xl:block p-4 bg-background">
        <div className="w-full xl:w-[300px] xl:shrink-0 mb-12 xl:mb-0 xl:absolute xl:left-4 xl:top-20">
          {/* Mobile/Tablet: Horizontal Stepper (no card) */}
          <div className="xl:hidden">
            <div className="flex justify-between items-start relative">
              {steps.map((step, index) => {
                const stepNumber = index + 1
                const isCompleted = stepNumber < currentStep
                const isCurrent = stepNumber === currentStep
                const isUpcoming = stepNumber > currentStep
                const isClickable = isCompleted && handleStepClick

                return (
                  <div key={index} className="flex flex-col items-center flex-1 relative">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold mb-2 bg-background ${
                        isCompleted ? 'border-primary text-primary' :
                        isCurrent ? 'border-primary text-primary' :
                        'border-muted-foreground/25 text-muted-foreground'
                      } ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                      onClick={() => isClickable && handleStepClick(stepNumber)}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
                    </div>
                    <p className={`text-xs text-center leading-tight ${
                      isCurrent ? 'text-primary font-medium' : 
                      isUpcoming ? 'text-muted-foreground' : 'text-foreground'
                    }`}>
                      {step.title.split(' ')[0]}
                    </p>

                    {/* Connecting line */}
                    {index < steps.length - 1 && (
                      <div className={`absolute top-4 left-[calc(50%+1rem)] w-[calc(100%-2rem)] h-0.5 ${
                        isCompleted ? 'bg-primary' : 'bg-muted-foreground/25'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Desktop: Vertical Stepper (with card) */}
          <div className="hidden xl:block">
            <Card className="p-4">
              <Stepper steps={steps} currentStep={currentStep} onStepClick={handleStepClick} />
            </Card>
          </div>
        </div>

        {/* Content - Centered on desktop */}
        <div className="flex-1 xl:flex xl:justify-center xl:items-start xl:pt-0 space-y-2 xl:max-w-none xl:mx-0">
          <div className="w-full xl:max-w-[600px] xl:space-y-2 space-y-2">
          {currentStep === 1 && (
            <>
              <div className="space-y-2 mb-6">
                <h2 className="text-2xl font-bold">Upload your content</h2>
                <p className="text-muted-foreground">
                  Deepreal will create a signed proof of authorship and prepare a QR watermark that links back to your verified record on Solana.
                </p>
              </div>
              <Card className="p-2 relative">
                {file && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-4 right-4 h-8 w-8 rounded-full shadow-lg bg-white hover:bg-gray-100 text-black z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Abort any ongoing processing
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                        abortControllerRef.current = null;
                      }
                      // Reset file input to allow re-uploading the same file
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
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div
                  className={`relative rounded-lg border-2 border-dashed transition-colors h-[300px] flex items-center justify-center ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  } ${loading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={onClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
                >
            {!file ? (
              <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Drop your image or video here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, MP4, MOV, WebM, or MKV files</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full p-2 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 max-w-full">
                  <div className="relative">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-auto h-auto object-contain max-h-[200px] max-w-full rounded-lg border"
                      />
                    ) : (
                      <>
                        <video
                          src={URL.createObjectURL(file)}
                          controls={!loading}
                          preload="metadata"
                          className="w-auto h-auto object-contain max-h-[200px] max-w-full rounded-lg border"
                        />
                        {loading && (
                          <div className="absolute inset-0 bg-transparent" style={{ pointerEvents: 'none' }} />
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-xs font-medium truncate max-w-md">{file.name}</p>
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
        </Card>

                {file && (
                  <div className="flex justify-center mt-6">
                    <Button
                      onClick={overlayQRCodeOnImage}
                      disabled={!file || !signer || !address || loading}
                      className="w-full sm:w-auto"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {loadingMessage}
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
                <div className="space-y-2 mb-6">
                  <h2 className="text-2xl font-bold">Download your verified, QR-coded content</h2>
                  <p className="text-muted-foreground">
                    Your media is now stamped with a QR code that proves it was vouched for by you. Download this watermarked version. It's ready to share anywhere.
                  </p>
                </div>
                <Card className="p-2 relative">
                  <div className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 h-[300px] flex items-center justify-center overflow-hidden">
                    {processedImage ? (
                      <img
                        src={processedImage}
                        alt="Image with QR Code"
                        className="w-auto h-auto object-contain max-h-[200px] max-w-full"
                      />
                    ) : processedVideoUrl ? (
                      <video
                        src={processedVideoUrl}
                        controls
                        className="w-auto h-auto object-contain max-h-[200px] max-w-full"
                      />
                    ) : null}
                  </div>
                </Card>
                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full sm:w-auto"
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
                    className="w-full sm:w-auto"
                  >
                    Next
                  </Button>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <>
                <div className="space-y-2 mb-6">
                  <h2 className="text-2xl font-bold">Share your verified content to social media</h2>
                  <p className="text-muted-foreground">
                    Post your watermarked content on any platform. Then paste the link back here so Deepreal can anchor your proof on Solana and make your authorship verifiable forever.
                  </p>
                </div>
                <Card className="p-3">
                  {processedVideoUrl && (
                    <p className="text-xs text-muted-foreground">Format: {processedVideoName?.split('.').pop()?.toUpperCase() || 'WEBM'} (depends on your browser capabilities)</p>
                  )}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Post Links</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add the links to your social media posts where you shared the watermarked content:
                    </p>
                    
                    {postLinks.map((link, index) => (
                      <div key={index} className="space-y-2">
                        <label className="text-sm font-medium">
                          Link to post {index + 1}
                        </label>
                        <div className="flex gap-2 items-center mt-1">
                          <div className="flex-1">
                            <Input
                              type="url"
                              placeholder={PLATFORM_PLACEHOLDERS[index % PLATFORM_PLACEHOLDERS.length]}
                              value={link}
                              onChange={(e) => updatePostLink(index, e.target.value)}
                              className="w-full"
                            />
                          </div>
                          {postLinks.length > 1 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removePostLink(index)}
                              className="shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={addPostLink}
                      className="w-fit"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add another link
                    </Button>
                  </div>
                </Card>
                <div className="flex justify-center mt-6">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={postLinks.every(link => !link.trim()) || loading}
                    onClick={submitPostLinks}
                  >
                    {loading ? 'Registering on Solana...' : 'Register post on Solana'}
                  </Button>
                </div>

                {/* Display second signature after submission */}
                {secondSignature && (
                  <Card className="p-6 mt-6">
                    <h3 className="text-lg font-semibold mb-4">Registration Complete!</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Original Watermark Signature</label>
                        <code className="bg-muted p-2 rounded text-sm block mt-1 break-all">
                          {firstSignature}
                        </code>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Post Registration Signature</label>
                        <code className="bg-muted p-2 rounded text-sm block mt-1 break-all">
                          {secondSignature}
                        </code>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a
                            href={`https://explorer.solana.com/tx/${secondSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View on Solana Explorer
                          </a>
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}