import type { NarrationState, NarrationSegmentConfig, WordTiming } from '@classflowai/types';
import { generateId } from '@classflowai/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Average speaking rate in words per minute used for TTS duration estimation. */
const AVERAGE_WORDS_PER_MINUTE = 150;

/** Maximum gap (in seconds) between two segments to still consider them adjacent. */
const DEFAULT_MERGE_GAP_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// Highlight types (module-local, exported for consumers)
// ---------------------------------------------------------------------------

export type WordHighlightState = 'past' | 'current' | 'future';

export interface HighlightedWord {
  word: string;
  index: number;
  state: WordHighlightState;
}

// ---------------------------------------------------------------------------
// 1. createNarrationState
// ---------------------------------------------------------------------------

/**
 * Create a default {@link NarrationState} with narration inactive,
 * no active segment, and full volume.
 */
export function createNarrationState(): NarrationState {
  return {
    isActive: false,
    currentSegmentId: null,
    volume: 1.0,
  };
}

// ---------------------------------------------------------------------------
// 2. activateNarration
// ---------------------------------------------------------------------------

/**
 * Return a new {@link NarrationState} with narration active and an optional
 * starting segment id.
 */
export function activateNarration(
  state: NarrationState,
  segmentId: string | null = null,
): NarrationState {
  return {
    ...state,
    isActive: true,
    currentSegmentId: segmentId,
  };
}

// ---------------------------------------------------------------------------
// 3. deactivateNarration
// ---------------------------------------------------------------------------

/**
 * Return a new {@link NarrationState} with narration inactive and the
 * current segment cleared.
 */
export function deactivateNarration(state: NarrationState): NarrationState {
  return {
    ...state,
    isActive: false,
    currentSegmentId: null,
  };
}

// ---------------------------------------------------------------------------
// 4. setVolume
// ---------------------------------------------------------------------------

/**
 * Return a new {@link NarrationState} with volume clamped to [0, 1].
 */
export function setVolume(state: NarrationState, volume: number): NarrationState {
  return {
    ...state,
    volume: clampVolume(volume),
  };
}

// ---------------------------------------------------------------------------
// 5. setCurrentSegment
// ---------------------------------------------------------------------------

/**
 * Return a new {@link NarrationState} with an updated current segment id.
 */
export function setCurrentSegment(
  state: NarrationState,
  segmentId: string | null,
): NarrationState {
  return {
    ...state,
    currentSegmentId: segmentId,
  };
}

// ---------------------------------------------------------------------------
// 6. createNarrationSegment
// ---------------------------------------------------------------------------

/**
 * Build a {@link NarrationSegmentConfig} from raw parameters.
 *
 * Word timings are automatically estimated by distributing the segment
 * duration proportionally to word length.
 *
 * @param text      The narration text.
 * @param startTime Absolute start time in the timeline (seconds).
 * @param duration  Duration of the segment (seconds).
 * @param audioUrl  Optional URL to a pre-rendered audio file.
 */
export function createNarrationSegment(
  text: string,
  startTime: number,
  duration: number,
  audioUrl: string | null = null,
): NarrationSegmentConfig {
  const endTime = startTime + duration;
  return {
    id: generateId('nar'),
    text,
    startTime,
    endTime,
    audioUrl,
    wordTimings: estimateWordTimings(text, startTime, endTime),
  };
}

// ---------------------------------------------------------------------------
// 7. estimateWordTimings
// ---------------------------------------------------------------------------

/**
 * Split {@link text} on whitespace and distribute time across words
 * proportionally to each word's character length.
 *
 * Returned {@link WordTiming} values use **absolute** timeline times so they
 * can be compared directly against a global playback clock.
 */
export function estimateWordTimings(
  text: string,
  startTime: number,
  endTime: number,
): WordTiming[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const totalDuration = endTime - startTime;

  if (totalDuration <= 0 || totalChars === 0) {
    return words.map((word, index) => ({
      word,
      startTime,
      endTime: startTime,
      index,
    }));
  }

  const timings: WordTiming[] = [];
  let cursor = startTime;

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const proportion = word.length / totalChars;
    const wordDuration = totalDuration * proportion;
    const wordEnd = i === words.length - 1 ? endTime : cursor + wordDuration;

    timings.push({
      word,
      startTime: cursor,
      endTime: wordEnd,
      index: i,
    });

    cursor = wordEnd;
  }

  return timings;
}

// ---------------------------------------------------------------------------
// 8. findSegmentAtTime
// ---------------------------------------------------------------------------

/**
 * Return the first segment whose time range contains {@link time}, or `null`.
 *
 * Segments are tested inclusively on the start boundary and exclusively on
 * the end boundary (`startTime <= time < endTime`).
 */
export function findSegmentAtTime(
  segments: NarrationSegmentConfig[],
  time: number,
): NarrationSegmentConfig | null {
  return segments.find((s) => time >= s.startTime && time < s.endTime) ?? null;
}

// ---------------------------------------------------------------------------
// 9. findWordAtTime
// ---------------------------------------------------------------------------

/**
 * Return the {@link WordTiming} entry that is active at the given
 * {@link time} within a segment, or `null` if no word matches.
 */
export function findWordAtTime(
  segment: NarrationSegmentConfig,
  time: number,
): WordTiming | null {
  return segment.wordTimings.find((w) => time >= w.startTime && time < w.endTime) ?? null;
}

// ---------------------------------------------------------------------------
// 10. calculateSegmentProgress
// ---------------------------------------------------------------------------

/**
 * Calculate progress (0–1) through a segment at a given time.
 *
 * Returns `0` for times before the segment and `1` for times at or after
 * its end.
 */
export function calculateSegmentProgress(
  segment: NarrationSegmentConfig,
  currentTime: number,
): number {
  const duration = segment.endTime - segment.startTime;
  if (duration <= 0) return 0;
  const elapsed = currentTime - segment.startTime;
  return clamp01(elapsed / duration);
}

// ---------------------------------------------------------------------------
// 11. calculateWordProgress
// ---------------------------------------------------------------------------

/**
 * Calculate progress (0–1) through the current word at a given time.
 *
 * If no word is active at {@link currentTime}, returns `0`.
 */
export function calculateWordProgress(
  segment: NarrationSegmentConfig,
  currentTime: number,
): number {
  const word = findWordAtTime(segment, currentTime);
  if (!word) return 0;

  const duration = word.endTime - word.startTime;
  if (duration <= 0) return 0;
  const elapsed = currentTime - word.startTime;
  return clamp01(elapsed / duration);
}

// ---------------------------------------------------------------------------
// 12. getHighlightedWords
// ---------------------------------------------------------------------------

/**
 * Given a segment and the current playback time, return every word annotated
 * with its highlight state:
 *
 * - **past** – the word has already been spoken
 * - **current** – the word is currently being spoken
 * - **future** – the word has not yet been spoken
 */
export function getHighlightedWords(
  segment: NarrationSegmentConfig,
  currentTime: number,
): HighlightedWord[] {
  return segment.wordTimings.map((wt) => {
    let state: WordHighlightState;
    if (currentTime >= wt.endTime) {
      state = 'past';
    } else if (currentTime >= wt.startTime) {
      state = 'current';
    } else {
      state = 'future';
    }

    return {
      word: wt.word,
      index: wt.index,
      state,
    };
  });
}

// ---------------------------------------------------------------------------
// 13. splitTextIntoSentences
// ---------------------------------------------------------------------------

/**
 * Split a body of text into sentences using common English punctuation
 * boundaries (`.`, `!`, `?`) while preserving the punctuation at the end
 * of each sentence.
 *
 * Empty results are filtered out and each sentence is trimmed.
 */
export function splitTextIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string.
  // The positive look-behind keeps the delimiter attached to the preceding sentence.
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// 14. estimateSpeechDuration
// ---------------------------------------------------------------------------

/**
 * Estimate how long it would take to speak {@link text} at an average rate
 * of ~150 words per minute.
 *
 * @returns Duration in **seconds**.
 */
export function estimateSpeechDuration(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  return (words.length / AVERAGE_WORDS_PER_MINUTE) * 60;
}

// ---------------------------------------------------------------------------
// 15. buildNarrationTimeline
// ---------------------------------------------------------------------------

/**
 * Given an ordered array of text strings (e.g. sentences) and an initial
 * time offset, produce a complete array of {@link NarrationSegmentConfig}
 * with non-overlapping, sequential timings.
 *
 * Each segment's duration is estimated via {@link estimateSpeechDuration}.
 *
 * @param texts       Ordered narration text strings.
 * @param startOffset Absolute time (seconds) at which the first segment begins.
 * @param gapBetween  Optional pause inserted between consecutive segments (seconds). Defaults to `0.25`.
 */
export function buildNarrationTimeline(
  texts: string[],
  startOffset: number = 0,
  gapBetween: number = 0.25,
): NarrationSegmentConfig[] {
  const segments: NarrationSegmentConfig[] = [];
  let cursor = startOffset;

  for (const text of texts) {
    if (text.trim().length === 0) continue;

    const duration = estimateSpeechDuration(text);
    segments.push(createNarrationSegment(text, cursor, duration));
    cursor += duration + gapBetween;
  }

  return segments;
}

// ---------------------------------------------------------------------------
// 16. getNarrationTextAtTime
// ---------------------------------------------------------------------------

/**
 * Return the concatenated narration text that should be visible up to the
 * given {@link currentTime} – useful for subtitle / caption display.
 *
 * For segments that have already completed, the full text is included.
 * For the currently active segment, only words whose start time is at or
 * before {@link currentTime} are included, providing a word-by-word reveal.
 *
 * @param segments    The full ordered narration timeline.
 * @param currentTime The current playback time (seconds).
 */
export function getNarrationTextAtTime(
  segments: NarrationSegmentConfig[],
  currentTime: number,
): string {
  const parts: string[] = [];

  for (const segment of segments) {
    if (currentTime >= segment.endTime) {
      // Segment fully in the past – include all text.
      parts.push(segment.text);
    } else if (currentTime >= segment.startTime) {
      // Currently active segment – include only revealed words.
      const revealedWords = segment.wordTimings
        .filter((wt) => currentTime >= wt.startTime)
        .map((wt) => wt.word);
      if (revealedWords.length > 0) {
        parts.push(revealedWords.join(' '));
      }
    }
    // Future segments are not shown.
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// 17. mergeAdjacentSegments
// ---------------------------------------------------------------------------

/**
 * Merge segments that are adjacent (or nearly adjacent within
 * {@link gapThreshold} seconds) into single, larger segments.
 *
 * Merged segments receive a new id, concatenated text (space-separated),
 * combined word timings (re-indexed), and recalculated start/end times.
 *
 * The first segment's `audioUrl` is preserved; if it is `null` the next
 * non-null url in the group is used.
 *
 * @param segments     Ordered narration segments.
 * @param gapThreshold Maximum gap (seconds) to still merge. Defaults to `0.3`.
 */
export function mergeAdjacentSegments(
  segments: NarrationSegmentConfig[],
  gapThreshold: number = DEFAULT_MERGE_GAP_THRESHOLD,
): NarrationSegmentConfig[] {
  if (segments.length === 0) return [];

  // Sort a shallow copy by startTime to be safe.
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);

  const merged: NarrationSegmentConfig[] = [];
  let group: NarrationSegmentConfig[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = group[group.length - 1]!;
    const current = sorted[i]!;
    const gap = current.startTime - prev.endTime;

    if (gap <= gapThreshold) {
      group.push(current);
    } else {
      merged.push(collapseGroup(group));
      group = [current];
    }
  }

  // Flush the last group.
  merged.push(collapseGroup(group));

  return merged;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a number to the [0, 1] range. */
function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/** Clamp volume to the [0, 1] range. */
function clampVolume(volume: number): number {
  return clamp01(volume);
}

/**
 * Collapse a group of segments into a single {@link NarrationSegmentConfig}.
 */
function collapseGroup(group: NarrationSegmentConfig[]): NarrationSegmentConfig {
  if (group.length === 1) return group[0]!;

  const first = group[0]!;
  const last = group[group.length - 1]!;

  const combinedText = group.map((s) => s.text).join(' ');
  const audioUrl = group.find((s) => s.audioUrl !== null)?.audioUrl ?? null;

  // Re-index word timings across all segments.
  let wordIndex = 0;
  const combinedTimings: WordTiming[] = [];

  for (const seg of group) {
    for (const wt of seg.wordTimings) {
      combinedTimings.push({
        word: wt.word,
        startTime: wt.startTime,
        endTime: wt.endTime,
        index: wordIndex++,
      });
    }
  }

  return {
    id: generateId('nar'),
    text: combinedText,
    startTime: first.startTime,
    endTime: last.endTime,
    audioUrl,
    wordTimings: combinedTimings,
  };
}
