import { Accidental, Beam, Formatter, Renderer, Stave, StaveConnector, StaveNote, Voice, VoiceMode } from 'vexflow';
import { jsPDF } from 'jspdf';
import type { ParsedSong } from '@/types';
import { midiToPitchName } from '@/midi/noteUtils';
import { buildScore, type ScoreEvent, type ScoreMeasure } from './buildScore';

/** Letter page at 150dpi. */
const PAGE_WIDTH = 1275;
const PAGE_HEIGHT = 1650;
const MARGIN = 70;
const MEASURES_PER_SYSTEM = 4;
const MEASURE_WIDTH = 220;
const FIRST_MEASURE_EXTRA_WIDTH = 90;
const SYSTEM_HEIGHT = 190;
const TITLE_BLOCK_HEIGHT = 130;
const STAFF_GAP = 90;

const DURATION_CODE: Record<number, string> = { 16: 'w', 8: 'h', 4: 'q', 2: '8', 1: '16' };

function midiToVexKey(midi: number): string {
  const { pitchClass, octave } = midiToPitchName(midi);
  const letter = pitchClass[0]!.toLowerCase();
  const accidental = pitchClass.length > 1 ? '#' : '';
  return `${letter}${accidental}/${octave}`;
}

function buildNotesForStaff(events: readonly ScoreEvent[], clef: 'treble' | 'bass'): StaveNote[] {
  return events.map((event) => {
    const isRest = event.midiKeys.length === 0;
    const duration = DURATION_CODE[event.slotCount] ?? 'q';

    if (isRest) {
      return new StaveNote({ keys: [clef === 'treble' ? 'b/4' : 'd/3'], duration: `${duration}r`, clef });
    }

    const keys = [...event.midiKeys].sort((a, b) => a - b).map(midiToVexKey);
    const note = new StaveNote({ keys, duration, clef });
    keys.forEach((key, i) => {
      if (key.includes('#')) note.addModifier(new Accidental('#'), i);
    });
    return note;
  });
}

/** Splits measures into fixed-size systems, then packs systems onto pages by how much page height remains (the first page reserves room for the title block, later pages don't). */
function paginate(measures: readonly ScoreMeasure[]): ScoreMeasure[][][] {
  const systems: ScoreMeasure[][] = [];
  for (let i = 0; i < measures.length; i += MEASURES_PER_SYSTEM) {
    systems.push(measures.slice(i, i + MEASURES_PER_SYSTEM));
  }

  const perFirstPage = Math.max(1, Math.floor((PAGE_HEIGHT - MARGIN * 2 - TITLE_BLOCK_HEIGHT) / SYSTEM_HEIGHT));
  const perOtherPage = Math.max(1, Math.floor((PAGE_HEIGHT - MARGIN * 2) / SYSTEM_HEIGHT));

  const pages: ScoreMeasure[][][] = [];
  let i = 0;
  if (systems.length > 0) {
    pages.push(systems.slice(0, perFirstPage));
    i = perFirstPage;
  }
  while (i < systems.length) {
    pages.push(systems.slice(i, i + perOtherPage));
    i += perOtherPage;
  }
  return pages;
}

function drawPage(systemsForPage: readonly ScoreMeasure[][], song: ParsedSong, isFirstPage: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  renderer.resize(PAGE_WIDTH, PAGE_HEIGHT);
  const context = renderer.getContext();
  context.setFillStyle('#ffffff');
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.setFillStyle('#000000');

  let y = MARGIN;
  if (isFirstPage) {
    context.save();
    context.setFont('serif', 26, 'bold');
    context.fillText(song.name, MARGIN, y + 26);
    context.setFont('serif', 13, 'normal');
    const keySig = song.keySignatureEvents[0];
    const keyLabel = keySig ? `${keySig.tonic} ${keySig.mode}` : null;
    const subtitle = [`♩ = ${Math.round(song.averageBpm)}`, keyLabel].filter(Boolean).join('   ·   ');
    context.fillText(subtitle, MARGIN, y + 52);
    context.restore();
    y += TITLE_BLOCK_HEIGHT;
  }

  for (const systemMeasures of systemsForPage) {
    let x = MARGIN;
    const trebleY = y + 20;
    const bassY = trebleY + STAFF_GAP;
    let firstTreble: Stave | null = null;
    let firstBass: Stave | null = null;
    let lastTreble: Stave | null = null;
    let lastBass: Stave | null = null;

    systemMeasures.forEach((measure, i) => {
      const isFirstInSystem = i === 0;
      const width = MEASURE_WIDTH + (isFirstInSystem ? FIRST_MEASURE_EXTRA_WIDTH : 0);

      const treble = new Stave(x, trebleY, width);
      const bass = new Stave(x, bassY, width);

      if (isFirstInSystem) {
        treble.addClef('treble').addTimeSignature(`${measure.numerator}/${measure.denominator}`);
        bass.addClef('bass').addTimeSignature(`${measure.numerator}/${measure.denominator}`);
      }

      treble.setContext(context).draw();
      bass.setContext(context).draw();

      const trebleNotes = buildNotesForStaff(measure.treble, 'treble');
      const bassNotes = buildNotesForStaff(measure.bass, 'bass');

      const trebleVoice = new Voice({ numBeats: measure.numerator, beatValue: measure.denominator }).setMode(VoiceMode.SOFT);
      trebleVoice.addTickables(trebleNotes);
      const bassVoice = new Voice({ numBeats: measure.numerator, beatValue: measure.denominator }).setMode(VoiceMode.SOFT);
      bassVoice.addTickables(bassNotes);

      new Formatter().joinVoices([trebleVoice]).joinVoices([bassVoice]).format([trebleVoice, bassVoice], width - 20);
      trebleVoice.draw(context, treble);
      bassVoice.draw(context, bass);

      for (const beam of [...Beam.generateBeams(trebleNotes.filter((n) => !n.isRest())), ...Beam.generateBeams(bassNotes.filter((n) => !n.isRest()))]) {
        beam.setContext(context).draw();
      }

      if (isFirstInSystem) {
        firstTreble = treble;
        firstBass = bass;
      }
      lastTreble = treble;
      lastBass = bass;
      x += width;
    });

    if (firstTreble && firstBass) {
      new StaveConnector(firstTreble, firstBass).setType('brace').setContext(context).draw();
      new StaveConnector(firstTreble, firstBass).setType('singleLeft').setContext(context).draw();
    }
    if (lastTreble && lastBass) {
      new StaveConnector(lastTreble, lastBass).setType('singleRight').setContext(context).draw();
    }

    y += SYSTEM_HEIGHT;
  }

  return canvas;
}

/**
 * Renders a parsed song as notated sheet music (quantized to a 16th-note grid, split across a
 * grand staff by each note's detected hand) and returns it as PDF file bytes.
 *
 * Draws directly to a `<canvas>` via VexFlow's Canvas backend rather than its SVG backend. The
 * SVG backend renders glyphs (noteheads, clefs, accidentals, rests) as `<text>` elements in
 * VexFlow's own music font — fine on-screen, but rasterizing that SVG through an `Image` (the
 * usual way to turn an SVG into a PNG for a PDF) runs in a browser-isolated context that doesn't
 * see the parent document's loaded `@font-face` fonts, so every glyph came out as a blank tofu
 * box. Canvas 2D text draws directly against `document.fonts`, so this sidesteps the problem
 * entirely — at the cost of the output being a raster image rather than selectable vectors.
 */
export async function renderScoreToPdf(song: ParsedSong): Promise<Uint8Array> {
  const measures = buildScore(song);
  if (measures.length === 0) throw new Error('This song has no notes to notate.');

  // VexFlow's bundled music font (Bravura) registers itself via the async FontFace API on
  // import; drawing before it's actually loaded is exactly what produced the missing glyphs.
  await document.fonts.ready;

  const pages = paginate(measures);
  const pdf = new jsPDF({ unit: 'px', format: [PAGE_WIDTH, PAGE_HEIGHT], hotfixes: ['px_scaling'] });

  for (let i = 0; i < pages.length; i++) {
    const canvas = drawPage(pages[i]!, song, i === 0);
    const dataUrl = canvas.toDataURL('image/png');
    if (i > 0) pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait');
    // Without an explicit compression mode, jsPDF embeds this as a raw uncompressed bitmap
    // (~3 bytes/pixel) instead of passing through the PNG's own compressed stream — 'FAST'
    // re-deflates it, which for a mostly-white notation page is a ~500x size difference.
    pdf.addImage(dataUrl, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, 'FAST');
  }

  return new Uint8Array(pdf.output('arraybuffer'));
}
