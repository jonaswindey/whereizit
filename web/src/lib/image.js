// Phone photos are 3-12 MB; shrinking before upload is what makes the capture loop feel instant.
export async function resizeImage (file, maxSide = 1600, quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality)
    )
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  } catch (err) {
    // Formats the browser can't decode (e.g. HEIC on desktop Chrome) go up as-is.
    console.warn('resize skipped:', err.message)
    return file
  }
}
