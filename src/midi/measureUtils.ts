import type { TimeSignatureEvent } from '@/types';

interface MeasureAnchor {
  readonly time: number;
  readonly measure: number;
  readonly secondsPerMeasure: number;
}

/**
 * Precomputes measure-boundary anchors from a sparse list of time signature
 * changes, so that `getMeasureAtTime` can answer in O(log n) without needing
 * MIDI tick data (which tempo changes would otherwise make non-linear in seconds).
 */
export class MeasureMap {
  private readonly anchors: MeasureAnchor[];

  constructor(timeSignatureEvents: readonly TimeSignatureEvent[], secondsPerBeatAt: (time: number) => number) {
    const events = timeSignatureEvents.length > 0 ? timeSignatureEvents : [{ time: 0, numerator: 4, denominator: 4, measure: 0 }];
    const anchors: MeasureAnchor[] = [];
    let measure = 0;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;
      const beatsPerMeasure = event.numerator * (4 / event.denominator);
      const secondsPerMeasure = secondsPerBeatAt(event.time) * beatsPerMeasure;
      anchors.push({ time: event.time, measure, secondsPerMeasure });

      const next = events[i + 1];
      if (next) {
        const elapsedMeasures = secondsPerMeasure > 0 ? (next.time - event.time) / secondsPerMeasure : 0;
        measure += Math.max(0, Math.round(elapsedMeasures));
      }
    }
    this.anchors = anchors;
  }

  /** Returns the zero-indexed measure number containing `time`. */
  getMeasureAtTime(time: number): number {
    let anchor = this.anchors[0] ?? { time: 0, measure: 0, secondsPerMeasure: 2 };
    for (const candidate of this.anchors) {
      if (candidate.time > time) break;
      anchor = candidate;
    }
    if (anchor.secondsPerMeasure <= 0) return anchor.measure;
    const elapsed = Math.max(0, time - anchor.time);
    return anchor.measure + Math.floor(elapsed / anchor.secondsPerMeasure);
  }

  /** Returns the fractional beat position (0-based) within the current measure at `time`. */
  getBeatInMeasure(time: number, numerator: number): number {
    let anchor = this.anchors[0] ?? { time: 0, measure: 0, secondsPerMeasure: 2 };
    for (const candidate of this.anchors) {
      if (candidate.time > time) break;
      anchor = candidate;
    }
    if (anchor.secondsPerMeasure <= 0) return 0;
    const secondsPerBeat = anchor.secondsPerMeasure / numerator;
    const elapsedInMeasure = Math.max(0, time - anchor.time) % anchor.secondsPerMeasure;
    return elapsedInMeasure / secondsPerBeat;
  }

  /** Inverse of `getMeasureAtTime`: the start time (seconds) of a zero-indexed measure. */
  getTimeAtMeasure(measure: number): number {
    let anchor = this.anchors[0] ?? { time: 0, measure: 0, secondsPerMeasure: 2 };
    for (const candidate of this.anchors) {
      if (candidate.measure > measure) break;
      anchor = candidate;
    }
    return anchor.time + Math.max(0, measure - anchor.measure) * anchor.secondsPerMeasure;
  }
}
