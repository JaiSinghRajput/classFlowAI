export interface EngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  status: EngineStatus;
}

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export interface CursorState {
  x: number;
  y: number;
  visible: boolean;
  style: CursorStyle;
}

export type CursorStyle = 'default' | 'pointer' | 'writing' | 'drawing';

export interface DrawingState {
  strokes: Stroke[];
  activeStroke: Stroke | null;
}

export interface Stroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  opacity: number;
}

export interface NarrationState {
  isActive: boolean;
  currentSegmentId: string | null;
  volume: number;
}

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: string;
  gridEnabled: boolean;
  gridSize: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

export type EasingFunction = (t: number) => number;

export interface StrokeAnimationConfig {
  strokeId: string;
  duration: number;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  delay: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextRevealConfig {
  mode: 'word' | 'character' | 'line' | 'block';
  speed: number;
  delay: number;
}

export interface TextRevealState {
  blockId: string;
  revealedLength: number;
  totalLength: number;
  isComplete: boolean;
}

export interface NarrationSegmentConfig {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  audioUrl: string | null;
  wordTimings: WordTiming[];
}

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  index: number;
}

export interface TimelineTrack {
  id: string;
  type: 'cursor' | 'drawing' | 'text' | 'narration' | 'highlight';
  events: import('./lesson').TimelineEvent[];
  locked: boolean;
  visible: boolean;
}

export interface TimelineBuildResult {
  tracks: TimelineTrack[];
  duration: number;
  eventCount: number;
  errors: TimelineValidationError[];
}

export interface TimelineValidationError {
  eventId: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ContentBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'code' | 'equation' | 'list' | 'diagram_instruction';
  content: string;
  children?: ContentBlock[];
  metadata?: Record<string, string>;
}

export interface ParsedExplanation {
  title: string;
  blocks: ContentBlock[];
  summary: string;
  estimatedReadTime: number;
}

// ---------------------------------------------------------------------------
// Playback Runtime Types
// ---------------------------------------------------------------------------

export interface ActiveEventsByType {
  cursor: import('./lesson').TimelineEvent[];
  drawing: import('./lesson').TimelineEvent[];
  text: import('./lesson').TimelineEvent[];
  narration: import('./lesson').TimelineEvent[];
  highlight: import('./lesson').TimelineEvent[];
}

export interface PlaybackSnapshot {
  engineState: EngineState;
  currentTime: number;
  deltaMs: number;
  progress: number;
  activeEvents: ActiveEventsByType;
  cursorState: CursorState;
  drawingState: DrawingState;
  narrationState: NarrationState;
}

export interface PlaybackConfig {
  targetFps: number;
  maxDeltaMs: number;
  autoPlay: boolean;
}

export interface PlaybackEventMap {
  frame: (snapshot: PlaybackSnapshot) => void;
  stateChange: (current: EngineState, previous: EngineState) => void;
  complete: () => void;
  seek: (fromTime: number, toTime: number) => void;
}
