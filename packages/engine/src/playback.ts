import type {
  EngineState,
  CursorState,
  CursorStyle,
  DrawingState,
  Stroke,
  NarrationState,
  TimelineTrack,
  TimelineEvent,
  PlaybackSnapshot,
  PlaybackConfig,
  PlaybackEventMap,
  ActiveEventsByType,
} from '@classflowai/types';
import { now, logger } from '@classflowai/utils';
import {
  advanceEngineState,
  pauseEngine,
  resumeEngine,
  seekEngine,
  setPlaybackRate,
  buildTimeline,
  getEventsAtTime,
  getTimelineProgress,
  setEngineDuration,
  setEngineStatus,
  createInitialEngineState,
} from './timeline';
import {
  getStrokeProgress,
  getPointAtDistance,
  calculatePathLength,
} from './drawing';
import { createNarrationState, activateNarration } from './narration';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TARGET_FPS = 60;
const DEFAULT_MAX_DELTA_MS = 100;
const DEFAULT_AUTO_PLAY = false;

const DEFAULT_CONFIG: PlaybackConfig = {
  targetFps: DEFAULT_TARGET_FPS,
  maxDeltaMs: DEFAULT_MAX_DELTA_MS,
  autoPlay: DEFAULT_AUTO_PLAY,
};

// ---------------------------------------------------------------------------
// Listener Map Type
// ---------------------------------------------------------------------------

interface ListenerMap {
  frame: Set<PlaybackEventMap['frame']>;
  stateChange: Set<PlaybackEventMap['stateChange']>;
  complete: Set<PlaybackEventMap['complete']>;
  seek: Set<PlaybackEventMap['seek']>;
}

// ---------------------------------------------------------------------------
// LessonPlaybackEngine
// ---------------------------------------------------------------------------

/**
 * Runtime engine that controls lesson playback.
 *
 * Sits on top of the pure-logic engine modules (timeline, drawing, narration,
 * explanation) and provides a real-time playback controller with high-precision
 * timing.
 *
 * **Tick model** – supports two modes:
 * 1. *External tick* – the consumer calls {@link tick} each frame, e.g. from
 *    `requestAnimationFrame`.  This is the recommended approach in browsers.
 * 2. *Self-managed loop* – call {@link startLoop} and the engine schedules
 *    its own ticks via `setTimeout` with drift compensation.  Useful for
 *    server-side or testing scenarios.
 *
 * Each tick produces a stateless {@link PlaybackSnapshot} that contains the
 * full derived state (cursor, drawing, narration) at the current time.
 * Because snapshots are recomputed from scratch, operations like
 * {@link seek} are trivially correct.
 */
export class LessonPlaybackEngine {
  // -----------------------------------------------------------------------
  // Private state
  // -----------------------------------------------------------------------

  private _state: EngineState;
  private _tracks: TimelineTrack[];
  private _config: PlaybackConfig;
  private _lastTickTimestamp: number;
  private _lastSnapshot: PlaybackSnapshot | null;

  /** Timer handle for the self-managed loop (`null` when not running). */
  private _loopTimer: ReturnType<typeof setTimeout> | null;
  /** Whether the self-managed loop is logically active. */
  private _loopRunning: boolean;
  /** Expected timestamp for the next self-managed tick (drift compensation). */
  private _nextTickTime: number;

  private _listeners: ListenerMap;

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  constructor(config?: Partial<PlaybackConfig>) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._state = createInitialEngineState();
    this._tracks = [];
    this._lastTickTimestamp = 0;
    this._lastSnapshot = null;
    this._loopTimer = null;
    this._loopRunning = false;
    this._nextTickTime = 0;
    this._listeners = {
      frame: new Set(),
      stateChange: new Set(),
      complete: new Set(),
      seek: new Set(),
    };
  }

  // -----------------------------------------------------------------------
  // Public getters
  // -----------------------------------------------------------------------

  /** Current engine state (defensive copy). */
  get state(): EngineState {
    return { ...this._state };
  }

  /** Current playback time in milliseconds. */
  get currentTime(): number {
    return this._state.currentTime;
  }

  /** Total timeline duration in milliseconds. */
  get duration(): number {
    return this._state.duration;
  }

  /** Timeline progress as a value between 0 and 1. */
  get progress(): number {
    return getTimelineProgress(this._state.currentTime, this._state.duration);
  }

  /** Whether the engine is currently playing. */
  get isPlaying(): boolean {
    return this._state.isPlaying;
  }

  /** Most recently computed snapshot, or `null` before the first tick. */
  get snapshot(): PlaybackSnapshot | null {
    return this._lastSnapshot;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Load a set of timeline tracks into the engine.
   *
   * The tracks are validated via {@link buildTimeline}; validation warnings
   * and errors are logged.  After loading, the engine transitions to `ready`
   * status.
   *
   * If {@link PlaybackConfig.autoPlay} is `true`, playback and the
   * self-managed loop start automatically.
   */
  load(tracks: TimelineTrack[]): void {
    const result = buildTimeline(tracks);
    this._tracks = result.tracks;

    for (const error of result.errors) {
      if (error.severity === 'error') {
        logger.error(`Timeline validation: ${error.message}`, { eventId: error.eventId });
      } else {
        logger.warn(`Timeline validation: ${error.message}`, { eventId: error.eventId });
      }
    }

    const previous = this._state;
    this._state = setEngineDuration(createInitialEngineState(), result.duration);
    this._lastSnapshot = null;
    this._emitStateChange(this._state, previous);

    logger.info('Timeline loaded', {
      tracks: result.tracks.length,
      events: result.eventCount,
      duration: result.duration,
    });

    if (this._config.autoPlay) {
      this.play();
      this.startLoop();
    }
  }

  /**
   * Stop playback, clear all listeners, and release resources.
   */
  destroy(): void {
    this.stopLoop();
    this._listeners.frame.clear();
    this._listeners.stateChange.clear();
    this._listeners.complete.clear();
    this._listeners.seek.clear();
    this._state = createInitialEngineState();
    this._tracks = [];
    this._lastSnapshot = null;
    this._lastTickTimestamp = 0;
  }

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  /**
   * Start or restart playback.
   *
   * If the timeline has reached its end, playback restarts from the
   * beginning.  Records the current high-precision timestamp so the next
   * tick can compute an accurate delta.
   */
  play(): void {
    if (this._state.status === 'playing') return;
    if (this._state.duration <= 0) {
      logger.warn('Cannot play: no timeline loaded or duration is zero');
      return;
    }

    const previous = this._state;

    if (this._state.currentTime >= this._state.duration) {
      this._state = seekEngine(this._state, 0);
    }

    this._state = resumeEngine(this._state);
    if (this._state.status !== 'playing') {
      this._state = setEngineStatus(this._state, 'playing');
    }

    this._lastTickTimestamp = now();
    this._emitStateChange(this._state, previous);
  }

  /**
   * Pause playback.  The current time is preserved so that
   * {@link resume} can continue from where it left off.
   */
  pause(): void {
    if (!this._state.isPlaying) return;

    const previous = this._state;
    this._state = pauseEngine(this._state);
    this._emitStateChange(this._state, previous);
  }

  /**
   * Resume playback from a paused state.
   *
   * Only effective when the engine status is `paused`.
   */
  resume(): void {
    if (this._state.status !== 'paused' && this._state.status !== 'ready') return;

    const previous = this._state;
    this._state = resumeEngine(this._state);
    this._lastTickTimestamp = now();
    this._emitStateChange(this._state, previous);
  }

  /**
   * Seek to an absolute time (ms) in the timeline.
   *
   * The time is clamped to `[0, duration]`.  A seek always triggers a
   * `seek` and `frame` event so that the UI can update immediately.
   */
  seek(timeMs: number): void {
    const fromTime = this._state.currentTime;
    const previous = this._state;
    this._state = seekEngine(this._state, timeMs);
    this._lastTickTimestamp = now();

    this._emitSeek(fromTime, this._state.currentTime);

    const snapshot = this._computeSnapshot(0);
    this._lastSnapshot = snapshot;
    this._emitFrame(snapshot);

    if (previous.status !== this._state.status) {
      this._emitStateChange(this._state, previous);
    }
  }

  /**
   * Set the playback speed multiplier.
   *
   * The rate is clamped to `[0.25, 4.0]` by the underlying pure function.
   */
  setSpeed(rate: number): void {
    const previous = this._state;
    this._state = setPlaybackRate(this._state, rate);
    if (this._state.playbackRate !== previous.playbackRate) {
      this._emitStateChange(this._state, previous);
    }
  }

  // -----------------------------------------------------------------------
  // Tick interface
  // -----------------------------------------------------------------------

  /**
   * Process a single tick using an externally-provided timestamp.
   *
   * Call this from `requestAnimationFrame` in the browser:
   *
   * ```ts
   * function loop(timestamp: number) {
   *   engine.tick(timestamp);
   *   requestAnimationFrame(loop);
   * }
   * requestAnimationFrame(loop);
   * ```
   *
   * @returns The computed {@link PlaybackSnapshot} for this frame.
   */
  tick(timestamp: number): PlaybackSnapshot {
    return this._processTick(timestamp);
  }

  // -----------------------------------------------------------------------
  // Self-managed loop
  // -----------------------------------------------------------------------

  /**
   * Start the self-managed tick loop.
   *
   * Uses `setTimeout` with drift compensation to maintain the target frame
   * rate.  The loop continues running even when paused (ticks are no-ops
   * for time advancement) so that {@link resume} does not require
   * restarting the loop.
   *
   * Call {@link stopLoop} to stop, or the loop auto-stops when the timeline
   * completes.
   */
  startLoop(): void {
    if (this._loopRunning) return;

    this._loopRunning = true;
    this._lastTickTimestamp = now();
    this._nextTickTime = this._lastTickTimestamp;
    this._scheduleNextTick();
  }

  /**
   * Stop the self-managed tick loop.
   */
  stopLoop(): void {
    this._loopRunning = false;
    if (this._loopTimer !== null) {
      clearTimeout(this._loopTimer);
      this._loopTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  /**
   * Register a listener for the given event.
   */
  on<K extends keyof PlaybackEventMap>(event: K, listener: PlaybackEventMap[K]): void {
    const set = this._listeners[event] as Set<PlaybackEventMap[K]>;
    set.add(listener);
  }

  /**
   * Remove a previously registered listener.
   */
  off<K extends keyof PlaybackEventMap>(event: K, listener: PlaybackEventMap[K]): void {
    const set = this._listeners[event] as Set<PlaybackEventMap[K]>;
    set.delete(listener);
  }

  // -----------------------------------------------------------------------
  // Private — tick processing
  // -----------------------------------------------------------------------

  /**
   * Core tick logic.  Computes delta from the last tick timestamp, caps it
   * at {@link PlaybackConfig.maxDeltaMs}, advances engine state, computes a
   * full snapshot, and emits events.
   */
  private _processTick(timestamp: number): PlaybackSnapshot {
    let deltaMs = this._lastTickTimestamp > 0
      ? timestamp - this._lastTickTimestamp
      : 0;
    this._lastTickTimestamp = timestamp;

    deltaMs = Math.min(Math.max(deltaMs, 0), this._config.maxDeltaMs);

    const previous = this._state;
    this._state = advanceEngineState(this._state, deltaMs);

    const snapshot = this._computeSnapshot(deltaMs);
    this._lastSnapshot = snapshot;
    this._emitFrame(snapshot);

    if (previous.isPlaying && !this._state.isPlaying && this._state.currentTime >= this._state.duration) {
      this._emitComplete();
      this._emitStateChange(this._state, previous);
      this.stopLoop();
    }

    return snapshot;
  }

  // -----------------------------------------------------------------------
  // Private — snapshot computation
  // -----------------------------------------------------------------------

  /**
   * Build a complete {@link PlaybackSnapshot} from the current engine state
   * and loaded tracks.  This is a stateless computation — every snapshot is
   * derived entirely from `currentTime` and the track data.
   */
  private _computeSnapshot(deltaMs: number): PlaybackSnapshot {
    const activeEvents = this._computeActiveEvents();

    return {
      engineState: { ...this._state },
      currentTime: this._state.currentTime,
      deltaMs,
      progress: getTimelineProgress(this._state.currentTime, this._state.duration),
      activeEvents,
      cursorState: this._computeCursorState(activeEvents),
      drawingState: this._computeDrawingState(),
      narrationState: this._computeNarrationState(activeEvents.narration),
    };
  }

  /**
   * Group all currently-active events across visible tracks by track type.
   */
  private _computeActiveEvents(): ActiveEventsByType {
    const result: ActiveEventsByType = {
      cursor: [],
      drawing: [],
      text: [],
      narration: [],
      highlight: [],
    };

    for (const track of this._tracks) {
      if (!track.visible) continue;

      const active = getEventsAtTime(track.events, this._state.currentTime);
      if (active.length === 0) continue;

      switch (track.type) {
        case 'cursor':
          result.cursor.push(...active);
          break;
        case 'drawing':
          result.drawing.push(...active);
          break;
        case 'text':
          result.text.push(...active);
          break;
        case 'narration':
          result.narration.push(...active);
          break;
        case 'highlight':
          result.highlight.push(...active);
          break;
      }
    }

    return result;
  }

  /**
   * Derive the cursor state from active cursor events.
   *
   * For the most recent active `cursor_move` event, progress through the
   * event is computed and the position is interpolated along the event's
   * path (if present) using arc-length parameterisation.
   *
   * The cursor style is inferred from concurrent event types:
   * - `drawing` → `'drawing'`
   * - `text`    → `'writing'`
   * - default   → `'pointer'`
   */
  private _computeCursorState(activeEvents: ActiveEventsByType): CursorState {
    if (activeEvents.cursor.length === 0) {
      return { x: 0, y: 0, visible: false, style: 'default' };
    }

    const event = activeEvents.cursor[activeEvents.cursor.length - 1]!;
    const eventDuration = event.endTime - event.startTime;
    const progress = eventDuration > 0
      ? clamp01((this._state.currentTime - event.startTime) / eventDuration)
      : 1;

    let x = 0;
    let y = 0;

    if (event.payload.path && event.payload.path.length > 0) {
      const totalLength = calculatePathLength(event.payload.path);
      const point = getPointAtDistance(event.payload.path, totalLength * progress);
      x = point.x;
      y = point.y;
    } else if (event.payload.position) {
      x = event.payload.position.x;
      y = event.payload.position.y;
    }

    let style: CursorStyle = 'pointer';
    if (activeEvents.drawing.length > 0) {
      style = 'drawing';
    } else if (activeEvents.text.length > 0) {
      style = 'writing';
    }

    return { x, y, visible: true, style };
  }

  /**
   * Derive the drawing state from all drawing-track events.
   *
   * - Events whose `endTime ≤ currentTime` contribute **completed** strokes.
   * - Events whose range contains `currentTime` contribute the **active**
   *   stroke, rendered as a partial path based on elapsed progress.
   */
  private _computeDrawingState(): DrawingState {
    const completedStrokes: Stroke[] = [];
    let activeStroke: Stroke | null = null;

    for (const track of this._tracks) {
      if (track.type !== 'drawing' || !track.visible) continue;

      for (const event of track.events) {
        if (!event.payload.path || event.payload.path.length === 0) continue;

        const color = event.payload.color ?? '#ffffff';
        const width = event.payload.strokeWidth ?? 2;

        if (this._state.currentTime >= event.endTime) {
          completedStrokes.push({
            id: event.id,
            points: event.payload.path,
            color,
            width,
            opacity: 1,
          });
        } else if (this._state.currentTime >= event.startTime) {
          const eventDuration = event.endTime - event.startTime;
          const progress = eventDuration > 0
            ? clamp01((this._state.currentTime - event.startTime) / eventDuration)
            : 1;
          const fullStroke: Stroke = {
            id: event.id,
            points: event.payload.path,
            color,
            width,
            opacity: 1,
          };
          activeStroke = {
            id: event.id,
            points: getStrokeProgress(fullStroke, progress),
            color,
            width,
            opacity: 1,
          };
        }
      }
    }

    return { strokes: completedStrokes, activeStroke };
  }

  /**
   * Derive the narration state from active narration events.
   *
   * If a narration event is active, the narration state is activated with
   * the event's id as the current segment identifier.
   */
  private _computeNarrationState(narrationEvents: TimelineEvent[]): NarrationState {
    const state = createNarrationState();

    if (narrationEvents.length === 0) return state;

    const event = narrationEvents[0]!;
    return activateNarration(state, event.id);
  }

  // -----------------------------------------------------------------------
  // Private — self-managed loop
  // -----------------------------------------------------------------------

  /**
   * Schedule the next tick of the self-managed loop with drift compensation.
   *
   * Uses `setTimeout` (not `setInterval`) to maintain accurate timing even
   * when individual ticks are delayed by garbage collection or other work.
   */
  private _scheduleNextTick(): void {
    const intervalMs = 1000 / this._config.targetFps;
    this._nextTickTime += intervalMs;

    const delay = Math.max(1, this._nextTickTime - now());

    this._loopTimer = setTimeout(() => {
      this._loopTimer = null;

      if (!this._loopRunning) return;

      const timestamp = now();
      this._processTick(timestamp);

      if (this._loopRunning) {
        if (this._nextTickTime < timestamp) {
          this._nextTickTime = timestamp;
        }
        this._scheduleNextTick();
      }
    }, delay);
  }

  // -----------------------------------------------------------------------
  // Private — event emission
  // -----------------------------------------------------------------------

  private _emitFrame(snapshot: PlaybackSnapshot): void {
    for (const listener of this._listeners.frame) listener(snapshot);
  }

  private _emitStateChange(current: EngineState, previous: EngineState): void {
    for (const listener of this._listeners.stateChange) listener(current, previous);
  }

  private _emitComplete(): void {
    for (const listener of this._listeners.complete) listener();
  }

  private _emitSeek(fromTime: number, toTime: number): void {
    for (const listener of this._listeners.seek) listener(fromTime, toTime);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a value to the [0, 1] range. */
function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
