import { create } from 'zustand';
import { getLiveInputController, type RecordedNote } from '@/live/LiveInputController';

interface LiveRecordingState {
  isRecording: boolean;
  lastRecording: RecordedNote[] | null;
  startRecording: () => void;
  stopRecording: () => void;
  clearLastRecording: () => void;
}

/** Thin wrapper around `LiveInputController`'s record buffer, so the Record button and post-record modal have React-visible state without owning the recording logic themselves. */
export const useLiveRecordingStore = create<LiveRecordingState>()((set) => ({
  isRecording: false,
  lastRecording: null,

  startRecording: () => {
    getLiveInputController().startRecording();
    set({ isRecording: true, lastRecording: null });
  },

  stopRecording: () => {
    const notes = getLiveInputController().stopRecording();
    set({ isRecording: false, lastRecording: notes.length > 0 ? notes : null });
  },

  clearLastRecording: () => set({ lastRecording: null }),
}));
