// Layer 1: wrapper of @capacitor/filesystem and @capacitor/share (frontend rule 5; FR-EXP-01, FR-EXP-02).
// It saves a PDF file and opens the share sheet. The export does not need the network.
import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { blobToBase64 } from '../shared/utils/jpeg-compress';

export interface FileSharePort {
  /** Saves the PDF file and opens the share sheet. A cancel by the user is not an error. */
  sharePdf(fileName: string, bytes: Uint8Array, title: string): Promise<void>;
}

/** The PDF bytes as a Blob. */
function toBlob(bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: 'application/pdf' });
}

/** The base64 text of the PDF bytes (the Filesystem plugin format). */
function base64Of(bytes: Uint8Array): Promise<string> {
  return blobToBase64(toBlob(bytes));
}

/** Mobile: write the file to the cache folder, then open the share sheet. */
async function shareNative(fileName: string, bytes: Uint8Array, title: string): Promise<void> {
  const { uri } = await Filesystem.writeFile({ path: fileName, data: await base64Of(bytes), directory: Directory.Cache });
  try {
    await Share.share({ title, files: [uri] });
  } catch {
    // The user closed the share sheet. This is not an error.
  }
}

/** Web: download the file with a temporary link. */
function download(fileName: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(toBlob(bytes));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function sharePdf(fileName: string, bytes: Uint8Array, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await shareNative(fileName, bytes, title);
    return;
  }
  download(fileName, bytes);
}

export const FILE_SHARE = new InjectionToken<FileSharePort>('FILE_SHARE', {
  providedIn: 'root',
  factory: () => ({ sharePdf }),
});
