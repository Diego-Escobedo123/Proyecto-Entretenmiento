/**
 * Imágenes que sube el usuario (foto de perfil, portada de una lista): se
 * recortan y achican en el navegador antes de mandarlas, así viajan y se
 * guardan livianas (como data URL).
 */

/** Formatos que se aceptan al elegir un archivo. */
export const ACCEPTED_IMAGE_TYPES = /^image\/(jpeg|png|webp)$/

/** Recorta al centro en un cuadrado de `size` × `size` (WebP si el navegador puede; si no, JPEG). */
export async function toSquareDataUrl(file: File, size: number): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    )
    const webp = canvas.toDataURL('image/webp', 0.85)
    if (webp.startsWith('data:image/webp')) return webp
    // JPEG no tiene transparencia: el fondo, del color de la app.
    const flat = document.createElement('canvas')
    flat.width = flat.height = size
    const fctx = flat.getContext('2d')!
    fctx.fillStyle = '#3b1f3a'
    fctx.fillRect(0, 0, size, size)
    fctx.drawImage(canvas, 0, 0)
    return flat.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}
