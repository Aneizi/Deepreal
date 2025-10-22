import React, { useCallback, useRef, useState, useEffect } from 'react'
import QRCode from 'qrcode'

type AcceptedFile = File | null

export default function Dropzone() {
  const [file, setFile] = useState<AcceptedFile>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [backendLink, setBackendLink] = useState<string>('')
  const [processedImage, setProcessedImage] = useState<string>('')
  const inputRef = useRef<HTMLInputElement | null>(null)

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
      return 'https://github.com/Aneizi/Deepreal'
    } catch (error) {
      console.error('Failed to fetch backend link:', error)
      return 'https://github.com/Aneizi/Deepreal' // Fallback
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
      setBackendLink(link)
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
    <div className="dropzone-wrapper">
      <div
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      >
        {!file && (
          <>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3v10" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 7l4-4 4 4" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 15v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="dropzone-text">Drop an image here, or click to select (PNG, JPG)</p>
          </>
        )}

        {file && (
          <div className="preview">
            <img src={URL.createObjectURL(file)} alt={file.name} />
            <p className="filename">{file.name}</p>
            <button className="remove" onClick={(e) => { e.stopPropagation(); setFile(null) }}>Remove</button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png, image/jpeg"
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
      </div>

      {/* Verify Button */}
      <div className="verify-section">
        <button 
          className="verify-button" 
          onClick={overlayQRCodeOnImage}
          disabled={!file || !qrCodeUrl}
        >
          Verify
        </button>
      </div>

      {/* Processed Image Display */}
      {processedImage && (
        <div className="processed-image-section">
          <h3>Processed Image</h3>
          <div className="processed-preview">
            <img src={processedImage} alt="Image with QR Code" className="processed-image" />
            <a href={processedImage} download="image-with-qr.png">
              <button className="download-button">Download Image</button>
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
