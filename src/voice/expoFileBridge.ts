import { File } from 'expo-file-system';
import {
  cacheDirectory,
  makeDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

import type { FileBridge } from './backendVoiceProvider';

/**
 * The only place that touches the filesystem.
 *
 * WHY THE WRITE USES THE LEGACY ASYNC API. The modern `File.write()` is
 * SYNCHRONOUS, and on a real device it threw on every spoken reply:
 *
 *   FunctionCallException: Calling the 'write' function has failed
 *   (at ExpoModulesCore/SyncFunctionDefinition.swift:137)
 *
 * That is the failure that made replies come back as text with "I could not
 * read that reply out loud". A spoken reply is not a small file — a 1,230
 * character answer comes back as 1.3MB of MP3, which is a ~1.8MB base64 string
 * pushed through a synchronous JSI call. `writeAsStringAsync` is asynchronous
 * and is the API built for exactly this, so the audio goes through it.
 *
 * Reads stay on the modern API: `File.base64()` is already async, and uploading
 * recordings works — transcripts come back correctly.
 */

const SPEECH_DIR = 'voice';

/** Extensions we know how to name. Anything else lands as .bin and still plays. */
const EXTENSION: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

let counter = 0;

export const expoFileBridge: FileBridge = {
  async readAsBase64(uri: string): Promise<string> {
    return new File(uri).base64();
  },

  /** Bytes on disk, or 0 if the file is not there. */
  async sizeOf(uri: string): Promise<number> {
    try {
      return new File(uri).info().size ?? 0;
    } catch {
      return 0;
    }
  },

  async writeBase64(base64: string, mimeType: string): Promise<string> {
    // Cache, not documents: spoken replies are disposable. The OS is free to
    // reclaim them, and nothing should be re-listening to yesterday's audio.
    const directory = `${cacheDirectory}${SPEECH_DIR}`;
    await makeDirectoryAsync(directory, { intermediates: true }).catch(() => {
      // Already there. `intermediates` makes this a no-op in the normal case;
      // swallowing keeps a benign race from failing a reply.
    });

    counter += 1;
    const extension = EXTENSION[mimeType.toLowerCase()] ?? 'bin';
    const uri = `${directory}/reply-${counter}.${extension}`;

    await writeAsStringAsync(uri, base64, { encoding: 'base64' });

    return uri;
  },
};

/**
 * Removes spoken replies written this session.
 *
 * Voice audio is a recording of a private conversation. It is disposable by
 * design, and it should not outlive the reason it existed.
 */
export function clearSpeechCache(): void {
  try {
    const directory = new File(`${cacheDirectory}${SPEECH_DIR}`);
    if (directory.exists) directory.delete();
  } catch {
    // Best effort. A cache we could not clear is not worth crashing over.
  }
}
