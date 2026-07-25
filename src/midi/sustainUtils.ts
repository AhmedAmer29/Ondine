import type { ControlChangeEvent, SustainPedalSpan } from '@/types';

const SUSTAIN_ENGAGE_THRESHOLD = 0.5;

/** Converts raw CC64 (sustain pedal) events into discrete held-down time spans. */
export function buildSustainSpans(events: readonly ControlChangeEvent[], songDuration: number): SustainPedalSpan[] {
  const spans: SustainPedalSpan[] = [];
  let downAt: number | null = null;

  for (const event of events) {
    const engaged = event.value >= SUSTAIN_ENGAGE_THRESHOLD;
    if (engaged && downAt === null) {
      downAt = event.time;
    } else if (!engaged && downAt !== null) {
      spans.push({ startTime: downAt, endTime: event.time });
      downAt = null;
    }
  }
  if (downAt !== null) {
    spans.push({ startTime: downAt, endTime: songDuration });
  }
  return spans;
}

export function isWithinSpans(time: number, spans: readonly SustainPedalSpan[]): boolean {
  for (const span of spans) {
    if (time >= span.startTime && time <= span.endTime) return true;
  }
  return false;
}

/** Returns true if the sustain pedal is held at `time`, via binary-search-friendly linear scan (spans are few). */
export function isSustainedAt(time: number, spans: readonly SustainPedalSpan[]): boolean {
  return isWithinSpans(time, spans);
}

/** If a note's release falls while the pedal is held, extends its audible end to when the pedal lifts. */
export function getSustainedEndTime(noteEndTime: number, spans: readonly SustainPedalSpan[]): number {
  for (const span of spans) {
    if (noteEndTime >= span.startTime && noteEndTime <= span.endTime) return span.endTime;
  }
  return noteEndTime;
}
