import { create } from 'zustand';
import { MAX_TEMPO_MULTIPLIER, MIN_TEMPO_MULTIPLIER, type LoopRegion, type PlaybackStatus, type TempoMultiplier } from '@/types';
import { getPlaybackEngine } from '@/audio/PlaybackEngine';

interface PlaybackState {
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  tempoMultiplier: TempoMultiplier;
  loopRegion: LoopRegion | null;
  masterVolumeDb: number;
  isMuted: boolean;
  metronomeEnabled: boolean;

  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  restart: () => void;
  seek: (seconds: number) => void;
  seekRatio: (ratio: number) => void;
  setTempoMultiplier: (multiplier: TempoMultiplier) => void;
  setLoopRegion: (region: LoopRegion | null) => void;
  setMasterVolumeDb: (db: number) => void;
  toggleMute: () => void;
  toggleMetronome: () => void;
  stepFrame: (direction: 1 | -1, fps: number) => void;
  stepMeasure: (direction: 1 | -1, secondsPerMeasure: number) => void;
  tickClock: () => void;
  resetForNewSong: (duration: number) => void;
}

const lastVolumeByDefault = -4;

export const usePlaybackStore = create<PlaybackState>()((set, get) => ({
  status: 'idle',
  currentTime: 0,
  duration: 0,
  tempoMultiplier: 1,
  loopRegion: null,
  masterVolumeDb: lastVolumeByDefault,
  isMuted: false,
  metronomeEnabled: false,

  play: async () => {
    const engine = getPlaybackEngine();
    await engine.play();
    set({ status: 'playing' });
  },

  pause: () => {
    getPlaybackEngine().pause();
    set({ status: 'paused' });
  },

  togglePlay: async () => {
    if (get().status === 'playing') {
      get().pause();
    } else {
      await get().play();
    }
  },

  restart: () => {
    getPlaybackEngine().stopAndRewind();
    set({ status: 'paused', currentTime: 0 });
  },

  seek: (seconds) => {
    const engine = getPlaybackEngine();
    engine.seek(seconds);
    set({ currentTime: seconds });
  },

  seekRatio: (ratio) => {
    const duration = get().duration;
    get().seek(Math.min(duration, Math.max(0, duration * ratio)));
  },

  setTempoMultiplier: (multiplier) => {
    const clamped = Math.min(MAX_TEMPO_MULTIPLIER, Math.max(MIN_TEMPO_MULTIPLIER, multiplier));
    getPlaybackEngine().setTempoMultiplier(clamped);
    set({ tempoMultiplier: clamped });
  },

  setLoopRegion: (region) => {
    getPlaybackEngine().setLoop(region);
    set({ loopRegion: region });
  },

  setMasterVolumeDb: (db) => {
    getPlaybackEngine().setMasterVolumeDb(db);
    set({ masterVolumeDb: db, isMuted: false });
  },

  toggleMute: () => {
    const engine = getPlaybackEngine();
    const { isMuted, masterVolumeDb } = get();
    if (isMuted) {
      engine.setMasterVolumeDb(masterVolumeDb);
      set({ isMuted: false });
    } else {
      engine.setMasterVolumeDb(-Infinity);
      set({ isMuted: true });
    }
  },

  toggleMetronome: () => {
    const enabled = !get().metronomeEnabled;
    getPlaybackEngine().setMetronomeEnabled(enabled);
    set({ metronomeEnabled: enabled });
  },

  stepFrame: (direction, fps) => {
    getPlaybackEngine().stepBy(direction / fps);
    set({ status: 'paused', currentTime: getPlaybackEngine().getCurrentTime() });
  },

  stepMeasure: (direction, secondsPerMeasure) => {
    getPlaybackEngine().stepBy(direction * secondsPerMeasure);
    set({ status: 'paused', currentTime: getPlaybackEngine().getCurrentTime() });
  },

  /** Called from a low-frequency rAF hook to keep UI-facing time in sync with the audio clock. */
  tickClock: () => {
    const engine = getPlaybackEngine();
    const time = engine.getCurrentTime();
    const playing = engine.isPlaying();
    const duration = get().duration;

    // Nothing stops the transport on its own at the end of a song — it would
    // otherwise keep running past the last note indefinitely. Catch it here,
    // the moment playback crosses the duration, and snap straight back to 0
    // rather than leaving it sitting wherever it happened to stop.
    if (playing && duration > 0 && time >= duration - 0.02) {
      engine.pause();
      engine.seek(0);
      set({ status: 'ended', currentTime: 0 });
      return;
    }

    set((state) => {
      const next: Partial<PlaybackState> = { currentTime: time };
      if (playing && state.status !== 'playing') next.status = 'playing';
      if (!playing && state.status === 'playing') next.status = 'paused';
      return next as PlaybackState;
    });
  },

  resetForNewSong: (duration) => {
    // A newly loaded song always starts from a clean slate — paused, at the
    // beginning, at normal speed — regardless of what the previous song was
    // doing. `loadSong()` already stops the transport at tick 0; this brings
    // the tempo (which loadSong doesn't touch) and UI state in line with it.
    getPlaybackEngine().setTempoMultiplier(1);
    set({ duration, currentTime: 0, status: 'idle', loopRegion: null, tempoMultiplier: 1 });
  },
}));
