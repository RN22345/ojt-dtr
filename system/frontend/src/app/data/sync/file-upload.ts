// Layer 2: the upload of one photo file to Supabase Storage (offline sync design, section 10, step 3).
// The sync engine uses only this interface, so that unit tests can give a fake.
import { InjectionToken, inject } from '@angular/core';
import { SUPABASE } from '../../core/supabase.client';
import { FILES } from '../../plugins/files.plugin';
import { base64ToBytes } from '../../shared/utils/jpeg-compress';
import { TransportError, errorKindOf } from './sync-transport';

export const ATTACHMENT_BUCKET = 'attachments';

export interface FileUploader {
  /**
   * Uploads the local file. A file that exists in Storage counts as uploaded, because a file cannot change
   * (an earlier sync stopped after the upload). Throws `TransportError`. A missing local file gives `refused`.
   */
  upload(localPath: string, storageKey: string): Promise<void>;
}

interface StorageErrorShape {
  message?: string;
  status?: number;
  statusCode?: string;
  code?: string;
}

function alreadyExists(error: StorageErrorShape): boolean {
  return error.statusCode === '409' || error.code === 'Duplicate' || error.code === 'ResourceAlreadyExists';
}

export const FILE_UPLOADER = new InjectionToken<FileUploader>('FILE_UPLOADER', {
  providedIn: 'root',
  factory: () => {
    const supabase = inject(SUPABASE);
    const files = inject(FILES);
    return {
      async upload(localPath, storageKey) {
        const base64 = await files.read(localPath);
        if (base64 === null) {
          throw new TransportError('refused', `Local file ${localPath} not found`);
        }
        let result;
        try {
          result = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .upload(storageKey, base64ToBytes(base64), { contentType: 'image/jpeg', upsert: false });
        } catch (error) {
          throw new TransportError('unreachable', String(error));
        }
        const error = result.error as StorageErrorShape | null;
        if (error && !alreadyExists(error)) {
          // A network failure has no status. Then the kind is `unreachable`.
          throw new TransportError(errorKindOf(error.status ?? 0), error.message ?? 'Upload failed');
        }
      },
    };
  },
});
