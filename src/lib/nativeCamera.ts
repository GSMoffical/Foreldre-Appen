import { isNative } from './capacitor'

/**
 * Capture or pick a single photo on native platforms and return it as a File
 * ready for the existing Tankestrøm pipeline (addFilesFromList). Returns null
 * on web, on user cancel, or on any failure — callers should treat null as a no-op.
 */
export async function capturePhotoAsFile(): Promise<File | null> {
  if (!isNative()) return null
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      promptLabelHeader: 'Legg til bilde',
      promptLabelPhoto: 'Velg fra bilder',
      promptLabelPicture: 'Ta bilde',
    })
    if (!photo?.webPath) return null
    const res = await fetch(photo.webPath)
    const blob = await res.blob()
    const rawFormat = (photo.format || 'jpeg').toLowerCase()
    const ext = rawFormat === 'jpg' ? 'jpeg' : rawFormat
    const type = blob.type || `image/${ext}`
    return new File([blob], `tankestrom-foto-${Date.now()}.${ext}`, { type })
  } catch (err) {
    console.info('[camera] capture cancelled or failed:', err)
    return null
  }
}
