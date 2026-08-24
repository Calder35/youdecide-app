import { Directory, File, Paths } from 'expo-file-system';

import type { FileBridge } from './backendVoiceProvider';

/**
 * The only place that touches the filesystem.
 *
 * Isolated behind `FileBridge` so the provider and the turn machine can be
 * tested without a device — and so the expo-file-system API changing (it did,
 * between SDK versions) is a one-file problem.
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

  async writeBase64(base64: string, mimeType: string): Promise<string> {
    // Cache, not documents: spoken replies are disposable. The OS is free to
    // reclaim them, and nothing should be re-listening to yesterday's audio.
    const directory = new Directory(Paths.cache, SPEECH_DIR);
    if (!directory.exists) directory.create({ intermediates: true });

    counter += 1;
    const extension = EXTENSION[mimeType.toLowerCase()] ?? 'bin';
    const file = new File(directory, `reply-${counter}.${extension}`);
    if (file.exists) file.delete();
    file.create();
    file.write(base64, { encoding: 'base64' });

    return file.uri;
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
    const directory = new Directory(Paths.cache, SPEECH_DIR);
    if (directory.exists) directory.delete();
  } catch {
    // Best effort. A cache we could not clear is not worth crashing over.
  }
}
