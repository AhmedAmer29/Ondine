import { Midi } from '@tonejs/midi';
import type { ParsedSong } from '@/types';
import { resolveSavePath, saveBinaryFile } from '@/utils/saveFile';

/**
 * Encodes a `ParsedSong` back into real MIDI file bytes, via `@tonejs/midi`'s write API — already
 * a dependency, previously only used for reading. Writes one output track per `song.tracks`
 * entry (rather than flattening every note into a single track) so a re-import — by Ondine or
 * anything else — sees the same per-track note grouping the file was loaded with. MIDI has no
 * native "hand" field; hand is always re-derived from track structure on load
 * (`detectHands`'s fast path only fires for an exact 2-track split), so collapsing to one track
 * silently discarded that split and let the pitch-clustering fallback reassign hands differently.
 */
export function writeMidiFile(song: ParsedSong): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(song.tempoEvents[0]?.bpm ?? 120);

  for (const sourceTrack of song.tracks) {
    if (sourceTrack.notes.length === 0) continue;
    const track = midi.addTrack();
    track.name = sourceTrack.name || song.name;
    track.channel = sourceTrack.channel;
    for (const note of sourceTrack.notes) {
      track.addNote({ midi: note.midi, time: note.time, duration: Math.max(0.02, note.duration), velocity: note.velocity });
    }
  }

  return midi.toArray();
}

/** Prompts for a save location (desktop) or downloads directly (web) and writes the song as a `.mid` file. Returns false if the user cancelled the desktop dialog. */
export async function saveMidiFile(song: ParsedSong): Promise<boolean> {
  const path = await resolveSavePath(`${song.name}.mid`, 'Save MIDI File', 'MIDI', ['mid']);
  if (!path) return false;
  await saveBinaryFile(path, writeMidiFile(song), 'audio/midi');
  return true;
}
