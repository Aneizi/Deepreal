import QRCode from 'qrcode'

/**
 * Generates a QR code canvas with a logo overlay
 * @param verifyLink - The URL to encode in the QR code
 * @param logoImage - Optional logo image to overlay in the center
 * @returns A canvas element containing the QR code
 */
export async function generateQrCanvas(
  verifyLink: string,
  logoImage?: HTMLImageElement
): Promise<HTMLCanvasElement> {
  const qrCanvas = document.createElement('canvas')

  await QRCode.toCanvas(qrCanvas, verifyLink, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' }
  })

  // Add logo overlay if provided
  if (logoImage) {
    const qrCtx = qrCanvas.getContext('2d')
    if (qrCtx) {
      // Wait for logo to load if not already loaded
      if (!logoImage.complete) {
        await new Promise<void>((resolve) => {
          logoImage.onload = () => resolve()
        })
      }

      const logoSize = qrCanvas.width * 0.2
      const logoX = (qrCanvas.width - logoSize) / 2
      const logoY = (qrCanvas.height - logoSize) / 2

      // Draw white background circle for logo
      qrCtx.fillStyle = '#ffffff'
      qrCtx.beginPath()
      qrCtx.arc(qrCanvas.width / 2, qrCanvas.height / 2, logoSize * 0.6, 0, 2 * Math.PI)
      qrCtx.fill()

      // Draw logo
      qrCtx.drawImage(logoImage, logoX, logoY, logoSize, logoSize)
    }
  }

  return qrCanvas
}
