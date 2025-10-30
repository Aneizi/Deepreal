const ALLOWED_MIME_TYPES = {
  images: ['image/png', 'image/jpeg'],
  videos: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/x-m4v']
}

const ALLOWED_EXTENSIONS = {
  images: ['.png', '.jpg', '.jpeg'],
  videos: ['.mp4', '.mov', '.webm', '.mkv']
}

const MIN_DIMENSIONS = {
  width: 128,
  height: 128
}

export interface FileValidationResult {
  isValid: boolean
  isVideo: boolean
  error?: string
}

/**
 * Validates if a file is an acceptable image or video file
 * Checks both MIME type and file extension for better compatibility
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  const fileName = file.name.toLowerCase()

  // Check MIME type and extension
  const isImageByType = ALLOWED_MIME_TYPES.images.includes(file.type)
  const isImageByExt = ALLOWED_EXTENSIONS.images.some(ext => fileName.endsWith(ext))
  const isVideoByType = ALLOWED_MIME_TYPES.videos.includes(file.type)
  const isVideoByExt = ALLOWED_EXTENSIONS.videos.some(ext => fileName.endsWith(ext))

  const isImage = isImageByType || isImageByExt
  const isVideo = isVideoByType || isVideoByExt

  if (!isImage && !isVideo) {
    return {
      isValid: false,
      isVideo: false,
      error: 'Only PNG, JPG images or MP4, MOV, WebM, MKV videos are allowed'
    }
  }

  // Validate dimensions
  try {
    if (isImage) {
      await validateImageDimensions(file)
    } else if (isVideo) {
      await validateVideoDimensions(file)
    }

    return {
      isValid: true,
      isVideo
    }
  } catch (error) {
    return {
      isValid: false,
      isVideo,
      error: error instanceof Error ? error.message : 'Failed to validate file'
    }
  }
}

/**
 * Validates that an image meets minimum dimension requirements
 */
async function validateImageDimensions(file: File): Promise<void> {
  const img = new Image()
  const imageUrl = URL.createObjectURL(file)

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        URL.revokeObjectURL(imageUrl)

        if (img.width < MIN_DIMENSIONS.width || img.height < MIN_DIMENSIONS.height) {
          reject(
            new Error(
              `Image is too small. Minimum size is ${MIN_DIMENSIONS.width}x${MIN_DIMENSIONS.height} pixels. ` +
              `Your image is ${img.width}x${img.height} pixels.`
            )
          )
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
  } catch (error) {
    URL.revokeObjectURL(imageUrl)
    throw error
  }
}

/**
 * Validates that a video meets minimum dimension requirements
 */
async function validateVideoDimensions(file: File): Promise<void> {
  const video = document.createElement('video')
  video.src = URL.createObjectURL(file)

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)

        if (video.videoWidth < MIN_DIMENSIONS.width || video.videoHeight < MIN_DIMENSIONS.height) {
          reject(
            new Error(
              `Video is too small. Minimum size is ${MIN_DIMENSIONS.width}x${MIN_DIMENSIONS.height} pixels. ` +
              `Your video is ${video.videoWidth}x${video.videoHeight} pixels.`
            )
          )
          return
        }

        resolve()
      }

      video.onerror = () => {
        URL.revokeObjectURL(video.src)
        reject(new Error('Failed to load video'))
      }
    })
  } catch (error) {
    URL.revokeObjectURL(video.src)
    throw error
  }
}
