import { File, Paths } from 'expo-file-system'
import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy'
import type { Attachment } from './bundle'

/** Where reports go (ADR 0008); the site keeps them 30 days. */
export const REPORTS_URL = 'https://remoteharness.app/api/reports'

/** A file's size in bytes, 0 when it cannot be read. */
export function fileSize(uri: string): number {
  try {
    return new File(uri).size ?? 0
  } catch {
    return 0
  }
}

export async function readAttachment(attachment: Attachment): Promise<Uint8Array> {
  return new File(attachment.uri).bytes()
}

export type UploadResult = { ok: true; id: string } | { ok: false; status: number | null }

/** Uploads one report zip; the site answers its ID. */
export async function uploadReport(zip: Uint8Array): Promise<UploadResult> {
  const file = new File(Paths.cache, `remote-harness-report-${Date.now()}.zip`)
  try {
    if (file.exists) file.delete()
    file.create()
    file.write(zip)
    const response = await uploadAsync(REPORTS_URL, file.uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { 'content-type': 'application/zip' },
    })
    if (response.status !== 201) return { ok: false, status: response.status }
    const body = JSON.parse(response.body) as { id?: unknown }
    return typeof body.id === 'string' ? { ok: true, id: body.id } : { ok: false, status: response.status }
  } catch {
    return { ok: false, status: null }
  } finally {
    try {
      if (file.exists) file.delete()
    } catch {
      // A leftover in the cache folder is cleaned by the system.
    }
  }
}
