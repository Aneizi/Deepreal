/**
 * Processes a video by drawing each frame to a canvas, overlaying a QR code,
 * and recording the result via MediaRecorder
 *
 * @param file - The video file to process
 * @param qrCanvas - Canvas containing the QR code to overlay
 * @param signal - Optional AbortSignal to cancel processing
 * @returns URL of the processed video blob
 */
export async function processVideoWithQr(
  file: File,
  qrCanvas: HTMLCanvasElement,
  signal?: AbortSignal
): Promise<string> {
  const video = document.createElement('video')
  video.src = URL.createObjectURL(file)
  video.muted = true // required for autoplay without user gesture
  video.playsInline = true

  // Wait for video metadata to load
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Processing cancelled'))
      return
    }
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video'))
    signal?.addEventListener('abort', () => reject(new Error('Processing cancelled')))
  })

  const width = Math.floor(video.videoWidth)
  const height = Math.floor(video.videoHeight)

  // Create canvas for drawing frames
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  // Compute QR size and position (bottom-left, ~20% of min dimension)
  const qrSize = Math.floor(Math.min(width, height) * 0.2)
  const padding = Math.floor(Math.min(width, height) * 0.02)
  const qrX = padding
  const qrY = height - qrSize - padding

  // Setup media recorder
  const fps = Math.min(30, Math.max(15, 30))
  const stream = canvas.captureStream(fps)

  const mimeCandidates = [
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/quicktime;codecs=h264',
    'video/quicktime',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ]
  const mimeType = mimeCandidates.find(t => MediaRecorder.isTypeSupported(t)) || ''
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  const done = new Promise<string>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' })
      const url = URL.createObjectURL(blob)
      resolve(url)
    }
  })

  recorder.start(200) // collect data every 200ms

  // Frame drawing function
  const drawFrame = () => {
    // Draw current video frame
    ctx.drawImage(video, 0, 0, width, height)

    // Draw semi-transparent white background behind QR
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20)

    // Draw QR code
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)
  }

  // Cleanup function
  const cleanup = () => {
    video.pause()
    if (rafId) cancelAnimationFrame(rafId)
    if (recorder.state !== 'inactive') recorder.stop()
    URL.revokeObjectURL(video.src)
  }

  // Handle abort signal
  if (signal) {
    signal.addEventListener('abort', cleanup)
  }

  // Use requestVideoFrameCallback if available, otherwise fallback to rAF
  const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
  let rafId = 0

  if (useRVFC) {
    const cb = (_now: number, _metadata: any) => {
      if (signal?.aborted) return
      drawFrame()
      // Schedule next frame while playing
      if (!video.paused && !video.ended) {
        ;(video as any).requestVideoFrameCallback(cb)
      }
    }
    ;(video as any).requestVideoFrameCallback(cb)
  } else {
    const loop = () => {
      if (signal?.aborted) return
      drawFrame()
      if (!video.paused && !video.ended) {
        rafId = requestAnimationFrame(loop)
      }
    }
    rafId = requestAnimationFrame(loop)
  }

  try {
    await video.play()

    // Wait for video to end
    await new Promise<void>((resolve, reject) => {
      video.onended = () => resolve()
      if (signal) {
        signal.addEventListener('abort', () => reject(new Error('Processing cancelled')))
      }
    })

    // Stop recording
    if (rafId) cancelAnimationFrame(rafId)
    recorder.stop()

    const url = await done

    // Cleanup
    URL.revokeObjectURL(video.src)

    return url
  } catch (error) {
    cleanup()
    throw error
  }
}
