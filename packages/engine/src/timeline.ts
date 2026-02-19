import type {
  TimelineEvent,
  TimelineEventType,
  EngineState,
  EngineStatus,
  TimelineTrack,
  TimelineBuildResult,
  TimelineValidationError,
} from '@classflowai/types';
import { generateId } from '@classflowai/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum allowed playback rate. */
const MIN_PLAYBACK_RATE = 0.25;

/** Maximum allowed playback rate. */
const MAX_PLAYBACK_RATE = 4.0;

/** Tolerance (ms) for detecting overlapping events within a track. */
const OVERLAP_TOLERANCE_MS = 1;

/** Gap threshold (ms) – gaps larger than this between events trigger a warning. */
const GAP_WARNING_THRESHOLD_MS = 5000;

// ---------------------------------------------------------------------------
// 1. createTimelineEvent
// ---------------------------------------------------------------------------

/**
 * Create a typed {@link TimelineEvent} with a generated unique id.
 */
export function createTimelineEvent(
  type: TimelineEventType,
  startTime: number,
  endTime: number,
  payload: TimelineEvent['payload'] = {},
): TimelineEvent {
  return {
    id: generateId('evt'),
    type,
    startTime,
    endTime,
    payload,
  };
}

// ---------------------------------------------------------------------------
// 2. getEventsAtTime
// ---------------------------------------------------------------------------

/**
 * Return all events whose time range contains {@link time}
 * (inclusive start, exclusive end).
 */
export function getEventsAtTime(events: TimelineEvent[], time: number): TimelineEvent[] {
  return events.filter((e) => time >= e.startTime && time < e.endTime);
}

// ---------------------------------------------------------------------------
// 3. getEventsByType
// ---------------------------------------------------------------------------

/**
 * Return all events matching the given {@link type}.
 */
export function getEventsByType(
  events: TimelineEvent[],
  type: TimelineEventType,
): TimelineEvent[] {
  return events.filter((e) => e.type === type);
}

// ---------------------------------------------------------------------------
// 4. sortTimelineEvents
// ---------------------------------------------------------------------------

/**
 * Return a new array of events sorted ascending by `startTime`, then by
 * `endTime` for events that start at the same time.
 */
export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
}

// ---------------------------------------------------------------------------
// 5. calculateTimelineDuration
// ---------------------------------------------------------------------------

/**
 * Return the maximum `endTime` across all events, which represents the total
 * duration of the timeline.  Returns `0` for an empty event list.
 */
export function calculateTimelineDuration(events: TimelineEvent[]): number {
  if (events.length === 0) return 0;
  return Math.max(...events.map((e) => e.endTime));
}

// ---------------------------------------------------------------------------
// 6. createInitialEngineState
// ---------------------------------------------------------------------------

/**
 * Create a default {@link EngineState} with playback stopped, time at zero,
 * and a 1× playback rate.
 */
export function createInitialEngineState(): EngineState {
  return {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    status: 'idle',
  };
}

// ---------------------------------------------------------------------------
// 7. createTimelineTrack
// ---------------------------------------------------------------------------

/**
 * Create a new {@link TimelineTrack} with the given type and an optional
 * initial set of events.
 */
export function createTimelineTrack(
  type: TimelineTrack['type'],
  events: TimelineEvent[] = [],
): TimelineTrack {
  return {
    id: generateId('trk'),
    type,
    events: [...events],
    locked: false,
    visible: true,
  };
}

// ---------------------------------------------------------------------------
// 8. addEventToTrack
// ---------------------------------------------------------------------------

/**
 * Return a new {@link TimelineTrack} with the given event appended.
 *
 * If the track is locked the original track is returned unchanged.
 */
export function addEventToTrack(
  track: TimelineTrack,
  event: TimelineEvent,
): TimelineTrack {
  if (track.locked) return track;
  return {
    ...track,
    events: [...track.events, event],
  };
}

// ---------------------------------------------------------------------------
// 9. removeEventFromTrack
// ---------------------------------------------------------------------------

/**
 * Return a new {@link TimelineTrack} with the event identified by
 * {@link eventId} removed.
 *
 * If the track is locked the original track is returned unchanged.
 */
export function removeEventFromTrack(
  track: TimelineTrack,
  eventId: string,
): TimelineTrack {
  if (track.locked) return track;
  return {
    ...track,
    events: track.events.filter((e) => e.id !== eventId),
  };
}

// ---------------------------------------------------------------------------
// 10. toggleTrackVisibility
// ---------------------------------------------------------------------------

/**
 * Return a new {@link TimelineTrack} with visibility toggled.
 */
export function toggleTrackVisibility(track: TimelineTrack): TimelineTrack {
  return {
    ...track,
    visible: !track.visible,
  };
}

// ---------------------------------------------------------------------------
// 11. lockTrack
// ---------------------------------------------------------------------------

/**
 * Return a new {@link TimelineTrack} marked as locked.
 */
export function lockTrack(track: TimelineTrack): TimelineTrack {
  return {
    ...track,
    locked: true,
  };
}

// ---------------------------------------------------------------------------
// 12. unlockTrack
// ---------------------------------------------------------------------------

/**
 * Return a new {@link TimelineTrack} marked as unlocked.
 */
export function unlockTrack(track: TimelineTrack): TimelineTrack {
  return {
    ...track,
    locked: false,
  };
}

// ---------------------------------------------------------------------------
// 13. buildTimeline
// ---------------------------------------------------------------------------

/**
 * Assemble a {@link TimelineBuildResult} from an array of tracks.
 *
 * The result includes the total duration, the aggregate event count across
 * all tracks, and any validation errors produced by {@link validateTimeline}.
 */
export function buildTimeline(tracks: TimelineTrack[]): TimelineBuildResult {
  const allEvents = tracks.flatMap((t) => t.events);
  const duration = calculateTimelineDuration(allEvents);
  const eventCount = allEvents.length;
  const errors = validateTimeline(tracks);

  return {
    tracks: tracks.map((t) => ({
      ...t,
      events: sortTimelineEvents(t.events),
    })),
    duration,
    eventCount,
    errors,
  };
}

// ---------------------------------------------------------------------------
// 14. validateTimeline
// ---------------------------------------------------------------------------

/**
 * Validate every track in the timeline and return an array of
 * {@link TimelineValidationError}s.
 *
 * Checks performed per-track:
 * 1. **Negative duration** – an event whose `endTime <= startTime`.
 * 2. **Overlap** – two events within the same track whose ranges overlap
 *    by more than {@link OVERLAP_TOLERANCE_MS}.
 * 3. **Large gap** – a gap between two consecutive events that exceeds
 *    {@link GAP_WARNING_THRESHOLD_MS}.
 */
export function validateTimeline(
  tracks: TimelineTrack[],
): TimelineValidationError[] {
  const errors: TimelineValidationError[] = [];

  for (const track of tracks) {
    const sorted = sortTimelineEvents(track.events);

    for (const event of sorted) {
      if (event.endTime <= event.startTime) {
        errors.push({
          eventId: event.id,
          message: `Event has non-positive duration (start=${event.startTime}, end=${event.endTime})`,
          severity: 'error',
        });
      }
    }

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;

      const overlap = prev.endTime - curr.startTime;
      if (overlap > OVERLAP_TOLERANCE_MS) {
        errors.push({
          eventId: curr.id,
          message: `Event overlaps with previous event "${prev.id}" by ${overlap.toFixed(1)}ms`,
          severity: 'error',
        });
      }

      const gap = curr.startTime - prev.endTime;
      if (gap > GAP_WARNING_THRESHOLD_MS) {
        errors.push({
          eventId: curr.id,
          message: `Large gap of ${gap.toFixed(0)}ms before event`,
          severity: 'warning',
        });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// 15. getTimelineProgress
// ---------------------------------------------------------------------------

/**
 * Calculate overall timeline progress as a value between 0 and 1.
 *
 * Returns `0` when {@link duration} is zero or negative.
 */
export function getTimelineProgress(currentTime: number, duration: number): number {
  if (duration <= 0) return 0;
  return clamp01(currentTime / duration);
}

// ---------------------------------------------------------------------------
// 16. advanceEngineState
// ---------------------------------------------------------------------------

/**
 * Pure function that advances the engine's current time by {@link deltaMs}
 * multiplied by the current playback rate.
 *
 * - If the engine is not playing, the state is returned unchanged.
 * - If the resulting time exceeds the duration, playback is stopped and the
 *   status transitions to `ready`.
 */
export function advanceEngineState(
  state: EngineState,
  deltaMs: number,
): EngineState {
  if (!state.isPlaying || state.status !== 'playing') {
    return { ...state };
  }

  const newTime = state.currentTime + deltaMs * state.playbackRate;

  if (newTime >= state.duration) {
    return {
      ...state,
      currentTime: state.duration,
      isPlaying: false,
      status: 'ready',
    };
  }

  return {
    ...state,
    currentTime: Math.max(0, newTime),
  };
}

// ---------------------------------------------------------------------------
// 17. pauseEngine
// ---------------------------------------------------------------------------

/**
 * Return a new {@link EngineState} representing paused playback.
 */
export function pauseEngine(state: EngineState): EngineState {
  if (!state.isPlaying) return { ...state };
  return {
    ...state,
    isPlaying: false,
    status: 'paused',
  };
}

// ---------------------------------------------------------------------------
// 18. resumeEngine
// ---------------------------------------------------------------------------

/**
 * Return a new {@link EngineState} representing resumed playback.
 *
 * Resuming is only possible from `paused` or `ready` status.
 */
export function resumeEngine(state: EngineState): EngineState {
  if (state.status !== 'paused' && state.status !== 'ready') {
    return { ...state };
  }
  return {
    ...state,
    isPlaying: true,
    status: 'playing',
  };
}

// ---------------------------------------------------------------------------
// 19. seekEngine
// ---------------------------------------------------------------------------

/**
 * Return a new {@link EngineState} with `currentTime` set to the given
 * value, clamped within the valid timeline range `[0, duration]`.
 */
export function seekEngine(state: EngineState, time: number): EngineState {
  return {
    ...state,
    currentTime: clampTime(time, 0, state.duration),
  };
}

// ---------------------------------------------------------------------------
// 20. setPlaybackRate
// ---------------------------------------------------------------------------

/**
 * Return a new {@link EngineState} with the playback rate set to
 * {@link rate}, clamped between {@link MIN_PLAYBACK_RATE} and
 * {@link MAX_PLAYBACK_RATE}.
 */
export function setPlaybackRate(state: EngineState, rate: number): EngineState {
  return {
    ...state,
    playbackRate: clampTime(rate, MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE),
  };
}

// ---------------------------------------------------------------------------
// 21. getActiveTracksAtTime
// ---------------------------------------------------------------------------

/**
 * Return all visible tracks that contain at least one event active at the
 * given {@link time}.
 */
export function getActiveTracksAtTime(
  tracks: TimelineTrack[],
  time: number,
): TimelineTrack[] {
  return tracks.filter(
    (t) => t.visible && t.events.some((e) => time >= e.startTime && time < e.endTime),
  );
}

// ---------------------------------------------------------------------------
// 22. mergeTimelineTracks
// ---------------------------------------------------------------------------

/**
 * Merge two tracks of the **same type** into a single track.
 *
 * The merged track receives a new id, combines both event arrays (sorted),
 * and inherits the visibility / lock state of the first track.
 *
 * Throws if the two tracks have different types.
 */
export function mergeTimelineTracks(
  a: TimelineTrack,
  b: TimelineTrack,
): TimelineTrack {
  if (a.type !== b.type) {
    throw new Error(
      `Cannot merge tracks of different types: "${a.type}" and "${b.type}"`,
    );
  }

  return {
    id: generateId('trk'),
    type: a.type,
    events: sortTimelineEvents([...a.events, ...b.events]),
    locked: a.locked,
    visible: a.visible,
  };
}

// ---------------------------------------------------------------------------
// 23. clampToTimeline
// ---------------------------------------------------------------------------

/**
 * Clamp a time value so that it falls within the valid range of the
 * timeline defined by the given set of events.
 *
 * The valid range is `[0, maxEndTime]` where `maxEndTime` is the latest
 * `endTime` across all events.  Returns `0` for empty event lists.
 */
export function clampToTimeline(events: TimelineEvent[], time: number): number {
  const duration = calculateTimelineDuration(events);
  return clampTime(time, 0, duration);
}

// ---------------------------------------------------------------------------
// 24. setEngineStatus
// ---------------------------------------------------------------------------

/**
 * Return a new {@link EngineState} with the status explicitly set.
 *
 * This is used for transitional states like `loading` or `error` that
 * cannot be expressed through the play/pause/seek helpers.
 */
export function setEngineStatus(
  state: EngineState,
  status: EngineStatus,
): EngineState {
  const isPlaying = status === 'playing';
  return {
    ...state,
    status,
    isPlaying,
  };
}

// ---------------------------------------------------------------------------
// 25. setEngineDuration
// ---------------------------------------------------------------------------

/**
 * Return a new {@link EngineState} with `duration` set and the status
 * transitioned to `ready` (provided the previous status was `loading` or
 * `idle`).
 */
export function setEngineDuration(
  state: EngineState,
  duration: number,
): EngineState {
  const nextStatus: EngineStatus =
    state.status === 'loading' || state.status === 'idle' ? 'ready' : state.status;
  return {
    ...state,
    duration: Math.max(0, duration),
    status: nextStatus,
  };
}

// ---------------------------------------------------------------------------
// 26. getTracksByType
// ---------------------------------------------------------------------------

/**
 * Return all tracks matching the given {@link type}.
 */
export function getTracksByType(
  tracks: TimelineTrack[],
  type: TimelineTrack['type'],
): TimelineTrack[] {
  return tracks.filter((t) => t.type === type);
}

// ---------------------------------------------------------------------------
// 27. getAllEventsFromTracks
// ---------------------------------------------------------------------------

/**
 * Flatten all events from an array of tracks into a single sorted event list.
 */
export function getAllEventsFromTracks(tracks: TimelineTrack[]): TimelineEvent[] {
  return sortTimelineEvents(tracks.flatMap((t) => t.events));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a value to the [0, 1] range. */
function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Clamp a value to an arbitrary [min, max] range. */
function clampTime(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
