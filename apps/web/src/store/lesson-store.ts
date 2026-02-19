'use client';

import { create } from 'zustand';
import type { 
  EngineState, 
  CursorState, 
  DrawingState, 
  NarrationState, 
  PlaybackSnapshot 
} from '@classflowai/types';

interface LessonState {
  lessonId: string | null;
  isLoading: boolean;
  error: string | null;
  engineState: EngineState;
  cursorState: CursorState;
  drawingState: DrawingState;
  narrationState: NarrationState;
  progress: number;
}

interface LessonActions {
  setLessonId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateSnapshot: (snapshot: PlaybackSnapshot) => void;
  reset: () => void;
}

const initialState: LessonState = {
  lessonId: null,
  isLoading: false,
  error: null,
  engineState: {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    status: 'idle',
  },
  cursorState: { x: 0, y: 0, visible: false, style: 'default' },
  drawingState: { strokes: [], activeStroke: null },
  narrationState: { isActive: false, currentSegmentId: null, volume: 1 },
  progress: 0,
};

export const useLessonStore = create<LessonState & LessonActions>((set) => ({
  ...initialState,

  setLessonId: (id) => set({ lessonId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  updateSnapshot: (snapshot) => set({
    engineState: snapshot.engineState,
    cursorState: snapshot.cursorState,
    drawingState: snapshot.drawingState,
    narrationState: snapshot.narrationState,
    progress: snapshot.progress,
  }),

  reset: () => set(initialState),
}));