import { readFile } from '@tauri-apps/plugin-fs';
import type { ParsedSong } from '@/types';
import { parseMidiFile } from './parseMidi';

/** Loads and parses a MIDI file dropped onto the app as a browser File object. */
export async function loadMidiFromFile(file: File): Promise<ParsedSong> {
  const buffer = await file.arrayBuffer();
  return parseMidiFile(buffer, file.name, null);
}

/** Loads and parses a MIDI file from an absolute filesystem path via the Tauri fs plugin. */
export async function loadMidiFromPath(path: string): Promise<ParsedSong> {
  const bytes = await readFile(path);
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return parseMidiFile(buffer, fileName, path);
}

export function isMidiFileName(name: string): boolean {
  return /\.(mid|midi)$/i.test(name);
}
