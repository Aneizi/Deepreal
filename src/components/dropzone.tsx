import React, { useCallback, useRef, useState, useEffect} from 'react'
import QRCode from 'qrcode'
import { Upload, Trash2, Plus, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Stepper } from '@/components/ui/stepper'
import { useSolana } from '@/components/solana/use-solana.tsx'
import { useNavigate } from 'react-router'
import {
  createTransaction,
  signAndSendTransactionMessageWithSigners,
  getBase58Decoder,
  type Address
} from 'gill'
import { getAddMemoInstruction } from 'gill/programs'
import { useWalletUiSigner } from '@wallet-ui/react'

type AcceptedFile = File | null

const steps = [
  { title: 'Upload and protect the content' },
  { title: 'Download watermarked version' },
  { title: 'Share and link the posts' },
]

export default function Dropzone() {
  const solana = useSolana()
  const account = solana.account
  const navigate = useNavigate()

  useEffect(() => {
    // If wallet disconnects, redirect to landing page
    if (!account) {
      navigate('/')
    }
  }, [account, navigate])

  // Check if account exists before trying to use it
  if (!account) {
    return null // Will redirect via useEffect
  }

  return <DropzoneWithWallet account={account} />
}

function DropzoneWithWallet({ account }: { account: any }) {
  const solana = useSolana()
  const address = account?.address as Address
  const signer = useWalletUiSigner({ account })


  const [file, setFile] = useState<AcceptedFile>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [processedImage, setProcessedImage] = useState<string>('')
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [postLinks, setPostLinks] = useState<string[]>([''])
  const [firstSignature, setFirstSignature] = useState<string>('')
  const [secondSignature, setSecondSignature] = useState<string>('')
  const [isDownloaded, setIsDownloaded] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)

  // Preload logo on mount
  React.useEffect(() => {
    const logo = new Image()
    logo.src = '/icon-light.svg'
    logoRef.current = logo
  }, [])

  // Platform placeholder examples
  const platformPlaceholders = [
    'https://x.com/username/status/123456789',
    'https://instagram.com/p/ABC123DEF',
    'https://facebook.com/username/posts/123456789',
    'https://tiktok.com/@username/video/123456789',
    'https://linkedin.com/posts/username_activity-123456789',
    'https://youtube.com/watch?v=ABC123DEF',
    'https://snapchat.com/t/ABC123DEF',
    'https://threads.net/@username/post/ABC123DEF'
  ]

  const handleStepClick = useCallback((step: number) => {
    setCurrentStep(step)
    if (step === 1) {
      // Reset to step 1 - clear processed image and download state
      setProcessedImage('')
      setIsDownloaded(false)
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


  // Function to overlay QR code on the uploaded image
  const overlayQRCodeOnImage = useCallback(async () => {
    if (!file) return
    if (!signer || !address) return

    setLoading(true)
    try {
      // Step 1: Sign transaction with memo (from sign-tx.tsx)
      const rpc = solana.client.rpc
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

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

      console.log('Transaction signed:', signatureString)

      // Store the first signature for use in step 3
      setFirstSignature(signatureString)

      // Step 2: Generate QR code linking to verification page
      const verifyLink = `https://usedeepreal.com/verify/${signatureString}`

      // Generate QR code with high error correction to allow logo overlay
      const qrCanvas = document.createElement('canvas')
      await QRCode.toCanvas(qrCanvas, verifyLink, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: 'H', // High error correction for logo overlay
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })

      // Add logo in the center of QR code (using cached logo)
      const qrCtx = qrCanvas.getContext('2d')
      if (qrCtx && logoRef.current) {
        // Wait for logo to load if not already loaded
        if (!logoRef.current.complete) {
          await new Promise<void>((resolve) => {
            logoRef.current!.onload = () => resolve()
          })
        }

        // Calculate logo size (about 20% of QR code) while maintaining aspect ratio
        const maxLogoSize = qrCanvas.width * 0.2
        const logoAspectRatio = logoRef.current.width / logoRef.current.height
        
        let logoWidth, logoHeight
        if (logoAspectRatio > 1) {
          // Wider than tall
          logoWidth = maxLogoSize
          logoHeight = maxLogoSize / logoAspectRatio
        } else {
          // Taller than wide or square
          logoHeight = maxLogoSize
          logoWidth = maxLogoSize * logoAspectRatio
        }
        
        const logoX = (qrCanvas.width - logoWidth) / 2
        const logoY = (qrCanvas.height - logoHeight) / 2

        // Draw white background circle for logo
        qrCtx.fillStyle = '#ffffff'
        qrCtx.beginPath()
        qrCtx.arc(qrCanvas.width / 2, qrCanvas.height / 2, maxLogoSize * 0.6, 0, 2 * Math.PI)
        qrCtx.fill()

        // Draw logo with preserved aspect ratio
        qrCtx.drawImage(logoRef.current, logoX, logoY, logoWidth, logoHeight)
      }

      // Step 3: Overlay QR code on the uploaded image
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Load the uploaded image
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = URL.createObjectURL(file)
      })

      // Set canvas size to match the image
      canvas.width = img.width
      canvas.height = img.height

      // Draw the original image
      ctx.drawImage(img, 0, 0)

      // Calculate QR code size and position (bottom-right corner, 20% of image width)
      const qrSize = Math.min(img.width, img.height) * 0.2
      const qrX = img.width - qrSize - 20
      const qrY = img.height - qrSize - 20

      // Draw semi-transparent white background for QR code
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20)

      // Draw the QR code directly from canvas (no need to convert to image)
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

      // Convert canvas to data URL and set as processed image
      const processedDataUrl = canvas.toDataURL('image/png')
      setProcessedImage(processedDataUrl)
      setCurrentStep(2) // Move to step 2 after verification

    } catch (error) {
      console.error('Failed to overlay QR code on image:', error)
    } finally {
      setLoading(false)
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
    const allowed = ['image/png', 'image/jpeg']
    if (!allowed.includes(f.type)) {
      alert('Only PNG or JPG files are allowed')
      return
    }

    // Validate image dimensions
    try {
      const img = new Image()
      const imageUrl = URL.createObjectURL(f)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(imageUrl)

          // Check minimum dimensions
          if (img.width < 128 || img.height < 128) {
            reject(new Error(`Image is too small. The minimum size is 128x128 pixels. Your image is ${img.width}x${img.height} pixels.`))
            return
          }

          resolve()
        }
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl)
          reject(new Error('Failed to load image'))
        }
        img.src = imageUrl
      })

      setFile(f)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to validate image')
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    onFiles(e.dataTransfer.files)
  }, [onFiles])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onClick = useCallback(() => inputRef.current?.click(), [])

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
                <h2 className="text-2xl font-bold">Upload your content to generate a cryptographic watermark</h2>
                <p className="text-muted-foreground">
                  Upload your image or video. Deepreal will create a signed proof of authorship and prepare a QR watermark that links back to your verified record on Solana.
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
                      setFile(null);
                      setProcessedImage('');
                      setCurrentStep(1);
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
                  }`}
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
                  <p className="text-sm font-medium">Drop your image here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">PNG or JPG files only</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full p-2 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 max-w-full">
                  <div className="relative">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      className="w-auto h-auto object-contain max-h-[200px] max-w-full rounded-lg border"
                    />
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
              accept="image/png, image/jpeg"
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
                      {loading ? 'Signing transaction...' : 'Generate watermark'}
                    </Button>
                  </div>
                )}
              </>
            )}

            {currentStep === 2 && processedImage && (
              <>
                <div className="space-y-2 mb-6">
                  <h2 className="text-2xl font-bold">Download your verified, QR-coded content</h2>
                  <p className="text-muted-foreground">
                    Your media is now stamped with a QR code that proves it was vouched for by you. Download this watermarked version. It's ready to share anywhere.
                  </p>
                </div>
                <Card className="p-2 relative">
                  <div className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 h-[300px] flex items-center justify-center overflow-hidden">
                    <img 
                      src={processedImage} 
                      alt="Image with QR Code" 
                      className="w-auto h-auto object-contain max-h-[200px] max-w-full"
                    />
                  </div>
                </Card>
                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                  {!isDownloaded ? (
                    <Button
                      asChild
                      className="w-full sm:w-auto"
                    >
                      <a 
                        href={processedImage} 
                        download="image-with-qr.png"
                        onClick={() => setIsDownloaded(true)}
                      >
                        Download file
                      </a>
                    </Button>
                  ) : (
                    <>
                      <Button
                        asChild
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        <a href={processedImage} download="image-with-qr.png">
                          Download file
                        </a>
                      </Button>
                      <Button
                        onClick={() => setCurrentStep(3)}
                        className="w-full sm:w-auto"
                      >
                        Next
                      </Button>
                    </>
                  )}
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
                              placeholder={platformPlaceholders[index % platformPlaceholders.length]}
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