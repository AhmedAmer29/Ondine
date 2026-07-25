import type { ParsedSong } from '@/types';
import { renderScoreToPdf } from '@/notation/renderScoreToPdf';
import { resolveSavePath, saveBinaryFile } from '@/utils/saveFile';

/** Renders the song as notated sheet music and prompts for a save location (desktop) or downloads directly (web). Returns false if the user cancelled the desktop dialog. */
export async function saveSheetMusicPdf(song: ParsedSong): Promise<boolean> {
  const bytes = await renderScoreToPdf(song);
  const path = await resolveSavePath(`${song.name}.pdf`, 'Save Sheet Music', 'PDF', ['pdf']);
  if (!path) return false;
  await saveBinaryFile(path, bytes, 'application/pdf');
  return true;
}
