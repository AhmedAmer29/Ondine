import type { PracticeHandMode } from './playback';

export interface PracticeSettings {
  enabled: boolean;
  handMode: PracticeHandMode;
  /** When true, playback pauses at each expected note/chord until it's played correctly. */
  waitForCorrectNote: boolean;
  highlightMistakes: boolean;
  /** Extra emphasis on the very next 1-2 seconds of notes, beyond the normal fall preview. */
  showUpcomingNotes: boolean;
  /** Faint long-range previews of notes further ahead than the normal fall window. */
  ghostNotes: boolean;
  loopOnMistake: boolean;
  countdownBeats: 0 | 1 | 2 | 4 | 8;
}

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  enabled: false,
  handMode: 'both',
  waitForCorrectNote: true,
  highlightMistakes: true,
  showUpcomingNotes: true,
  ghostNotes: true,
  loopOnMistake: false,
  countdownBeats: 4,
};

export type NoteJudgement = 'correct' | 'wrong' | 'missed' | 'pending';

export interface PracticeNoteState {
  readonly noteId: number;
  judgement: NoteJudgement;
  hitTime: number | null;
}

export interface PracticeStats {
  totalNotes: number;
  correctNotes: number;
  wrongNotes: number;
  missedNotes: number;
  accuracy: number;
  streak: number;
  bestStreak: number;
}

export const EMPTY_PRACTICE_STATS: PracticeStats = {
  totalNotes: 0,
  correctNotes: 0,
  wrongNotes: 0,
  missedNotes: 0,
  accuracy: 0,
  streak: 0,
  bestStreak: 0,
};
