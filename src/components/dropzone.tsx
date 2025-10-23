import React, { useCallback, useRef, useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Stepper } from '@/components/ui/stepper'

type AcceptedFile = File | null

const steps = [
  { title: 'Upload and protect the content' },
  { title: 'Download watermarked version' },
  { title: 'Share and register' },
]

export default function Dropzone() {
  const [file, setFile] = useState<AcceptedFile>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [processedImage, setProcessedImage] = useState<string>('')
  const [currentStep, setCurrentStep] = useState(1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleStepClick = useCallback((step: number) => {
    setCurrentStep(step)
    if (step === 1) {
      // Reset to step 1 - clear processed image
      setProcessedImage('')
    }
  }, [])

  // Mock function to get link from backend
  const fetchBackendLink = useCallback(async (): Promise<string> => {
    try {
      // TODO: Replace with actual backend API call
      // const response = await fetch('/api/get-link')
      // const data = await response.json()
      // return data.link
      
      // Mock delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Return mock link or fallback
      return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    } catch (error) {
      console.error('Failed to fetch backend link:', error)
      return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // Fallback
    }
  }, [])

  // Generate QR code from link
  const generateQRCode = useCallback(async (link: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(link, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      setQrCodeUrl(qrDataUrl)
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    }
  }, [])

  // Fetch link and generate QR code on component mount
  useEffect(() => {
    const initializeQRCode = async () => {
      const link = await fetchBackendLink()
      await generateQRCode(link)
    }
    
    initializeQRCode()
  }, [fetchBackendLink, generateQRCode])

  // Function to overlay QR code on the uploaded image
  const overlayQRCodeOnImage = useCallback(async () => {
    if (!file || !qrCodeUrl) return

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Load the uploaded image
      const img = new Image()
      const qrImg = new Image()

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = URL.createObjectURL(file)
      })

      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve()
        qrImg.onerror = reject
        qrImg.src = qrCodeUrl
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

      // Draw the QR code
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

      // Convert canvas to data URL and set as processed image
      const processedDataUrl = canvas.toDataURL('image/png')
      setProcessedImage(processedDataUrl)
      setCurrentStep(2) // Move to step 2 after verification

    } catch (error) {
      console.error('Failed to overlay QR code on image:', error)
    }
  }, [file, qrCodeUrl])

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const f = files[0]
    const allowed = ['image/png', 'image/jpeg']
    if (!allowed.includes(f.type)) {
      alert('Only PNG or JPG files are allowed')
      return
    }
    setFile(f)
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
      <div className="fixed top-20 left-4 z-40 w-80">
        <Card className="p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Stepper steps={steps} currentStep={currentStep} onStepClick={handleStepClick} />
        </Card>
      </div>
      
      <div className="min-h-screen flex items-start justify-center p-4 bg-background pt-20">
        <div className="w-full max-w-2xl space-y-2">
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
                  className={`relative rounded-lg border-2 border-dashed transition-colors h-[400px] flex items-center justify-center ${
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
                      className="w-auto h-auto object-contain max-h-[300px] max-w-full rounded-lg border"
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
                      disabled={!file || !qrCodeUrl}
                      className="w-full sm:w-auto"
                    >
                      Generate watermark
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
                  <div className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 h-[400px] flex items-center justify-center overflow-hidden">
                    <img 
                      src={processedImage} 
                      alt="Image with QR Code" 
                      className="w-auto h-auto object-contain max-h-[380px] max-w-full"
                    />
                  </div>
                </Card>
                <div className="flex justify-center mt-6">
                  <Button 
                    asChild
                    className="w-full sm:w-auto"
                  >
                    <a href={processedImage} download="image-with-qr.png">
                      Download file
                    </a>
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
                <Card className="p-6">
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-center py-12">
                      Step 3 content coming soon...
                    </p>
                  </div>
                </Card>
                <div className="flex justify-center mt-6">
                  <Button 
                    className="w-full sm:w-auto"
                    disabled
                  >
                    Register post on Solana
                  </Button>
                </div>
              </>
            )}
        </div>
      </div>
    </>
  )
}