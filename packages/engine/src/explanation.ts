import type {
  ExplanationBlock,
  ContentBlock,
  ParsedExplanation,
  TextRevealConfig,
  TextRevealState,
} from '@classflowai/types';
import { generateId } from '@classflowai/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Average reading speed in words per minute for standard text. */
const WORDS_PER_MINUTE = 150;

/** Multiplier applied to code blocks (read slower than prose). */
const CODE_DURATION_MULTIPLIER = 1.8;

/** Multiplier applied to equation blocks (read slower than prose). */
const EQUATION_DURATION_MULTIPLIER = 2.0;

/** Multiplier applied to diagram blocks. */
const DIAGRAM_DURATION_MULTIPLIER = 2.2;

/** Minimum duration (ms) assigned to any single block. */
const MIN_BLOCK_DURATION_MS = 1000;

/** Base transition delay (ms) between two consecutive blocks. */
const BASE_TRANSITION_DELAY_MS = 300;

/** Extra transition delay (ms) when the block type changes. */
const TYPE_CHANGE_TRANSITION_BONUS_MS = 400;

/** Extra transition delay (ms) when transitioning into or out of a code block. */
const CODE_TRANSITION_BONUS_MS = 200;

// ---------------------------------------------------------------------------
// 1. createExplanationBlock
// ---------------------------------------------------------------------------

/**
 * Create a typed {@link ExplanationBlock} with a generated unique id.
 */
export function createExplanationBlock(
  type: ExplanationBlock['type'],
  content: string,
  order: number,
  duration: number,
): ExplanationBlock {
  return {
    id: generateId('exp'),
    type,
    content,
    order,
    duration,
  };
}

// ---------------------------------------------------------------------------
// 2. sortBlocks
// ---------------------------------------------------------------------------

/**
 * Return a new array of {@link ExplanationBlock} sorted ascending by `order`.
 */
export function sortBlocks(blocks: ExplanationBlock[]): ExplanationBlock[] {
  return [...blocks].sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// 3. calculateTotalDuration
// ---------------------------------------------------------------------------

/**
 * Sum the `duration` values of every block in the provided array (ms).
 */
export function calculateTotalDuration(blocks: ExplanationBlock[]): number {
  return blocks.reduce((total, block) => total + block.duration, 0);
}

// ---------------------------------------------------------------------------
// 12. splitIntoWords
// ---------------------------------------------------------------------------

/**
 * Split a string into an array of non-empty word tokens.
 */
export function splitIntoWords(content: string): string[] {
  return content.split(/\s+/).filter((word) => word.length > 0);
}

// ---------------------------------------------------------------------------
// 13. splitIntoLines
// ---------------------------------------------------------------------------

/**
 * Split a string into individual lines. Trailing empty lines are preserved to
 * maintain positional accuracy when revealing content line-by-line.
 */
export function splitIntoLines(content: string): string[] {
  return content.split(/\r?\n/);
}

// ---------------------------------------------------------------------------
// 11. estimateReadTime
// ---------------------------------------------------------------------------

/**
 * Estimate the time (in milliseconds) required to read the given string at
 * {@link WORDS_PER_MINUTE} words per minute.  Returns a minimum of
 * {@link MIN_BLOCK_DURATION_MS} so that even very short strings produce a
 * meaningful duration.
 */
export function estimateReadTime(text: string): number {
  const words = splitIntoWords(text);
  if (words.length === 0) return MIN_BLOCK_DURATION_MS;
  const minutes = words.length / WORDS_PER_MINUTE;
  return Math.max(Math.round(minutes * 60 * 1000), MIN_BLOCK_DURATION_MS);
}

// ---------------------------------------------------------------------------
// 6. calculateBlockDuration
// ---------------------------------------------------------------------------

/**
 * Estimate a suitable display duration (ms) for a single {@link ContentBlock}
 * based on its type and content length.
 *
 * - `heading` / `paragraph` / `list` — standard reading pace (~150 WPM).
 * - `code` — slower multiplier ({@link CODE_DURATION_MULTIPLIER}).
 * - `equation` — slower multiplier ({@link EQUATION_DURATION_MULTIPLIER}).
 * - `diagram_instruction` — slowest ({@link DIAGRAM_DURATION_MULTIPLIER}).
 */
export function calculateBlockDuration(block: ContentBlock): number {
  const baseTime = estimateReadTime(block.content);

  switch (block.type) {
    case 'code':
      return Math.max(Math.round(baseTime * CODE_DURATION_MULTIPLIER), MIN_BLOCK_DURATION_MS);
    case 'equation':
      return Math.max(Math.round(baseTime * EQUATION_DURATION_MULTIPLIER), MIN_BLOCK_DURATION_MS);
    case 'diagram_instruction':
      return Math.max(Math.round(baseTime * DIAGRAM_DURATION_MULTIPLIER), MIN_BLOCK_DURATION_MS);
    case 'heading':
    case 'paragraph':
    case 'list':
    default:
      return baseTime;
  }
}

// ---------------------------------------------------------------------------
// 4. parseRawExplanation
// ---------------------------------------------------------------------------

/**
 * Parse a raw Markdown-like explanation string into a structured
 * {@link ParsedExplanation}.
 *
 * Supported syntax:
 * - `# Heading`              → ContentBlock type `heading`
 * - ` ```…``` `              → ContentBlock type `code`
 * - `$$ … $$`                → ContentBlock type `equation`
 * - Lines beginning with `- `→ ContentBlock type `list`
 * - Everything else          → ContentBlock type `paragraph`
 *
 * The first heading encountered (if any) becomes the `title`.
 * The `summary` is derived from the first paragraph block.
 */
export function parseRawExplanation(raw: string): ParsedExplanation {
  const lines = splitIntoLines(raw);
  const blocks: ContentBlock[] = [];

  let title = '';
  let summary = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // --- blank / whitespace-only lines → skip ---
    if (line.trim().length === 0) {
      i++;
      continue;
    }

    // --- code fence ``` ---
    if (line.trim().startsWith('```')) {
      const metadataLanguage = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++; // move past opening fence
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing fence (or end of input)

      const metadata: Record<string, string> = {};
      if (metadataLanguage.length > 0) {
        metadata['language'] = metadataLanguage;
      }

      blocks.push({
        id: generateId('cb'),
        type: 'code',
        content: codeLines.join('\n'),
        metadata,
      });
      continue;
    }

    // --- equation $$ ---
    if (line.trim().startsWith('$$')) {
      // Inline single-line equation: $$ content $$
      const inlineMatch = line.trim().match(/^\$\$(.+?)\$\$$/);
      if (inlineMatch) {
        blocks.push({
          id: generateId('cb'),
          type: 'equation',
          content: inlineMatch[1]!.trim(),
        });
        i++;
        continue;
      }

      // Multi-line equation
      const eqLines: string[] = [];
      const firstContent = line.trim().slice(2).trim();
      if (firstContent.length > 0) {
        eqLines.push(firstContent);
      }
      i++;
      while (i < lines.length) {
        const eqLine = lines[i]!;
        if (eqLine.trim().endsWith('$$')) {
          const lastContent = eqLine.trim().slice(0, -2).trim();
          if (lastContent.length > 0) {
            eqLines.push(lastContent);
          }
          i++;
          break;
        }
        eqLines.push(eqLine);
        i++;
      }

      blocks.push({
        id: generateId('cb'),
        type: 'equation',
        content: eqLines.join('\n').trim(),
      });
      continue;
    }

    // --- heading # ---
    if (line.trim().startsWith('#')) {
      const headingMatch = line.trim().match(/^(#{1,6})\s+(.*)/);
      const headingText = headingMatch ? headingMatch[2]!.trim() : line.trim().slice(1).trim();
      const level = headingMatch ? headingMatch[1]!.length.toString() : '1';

      if (title.length === 0) {
        title = headingText;
      }

      blocks.push({
        id: generateId('cb'),
        type: 'heading',
        content: headingText,
        metadata: { level },
      });
      i++;
      continue;
    }

    // --- list item (- ) ---
    if (line.trim().startsWith('- ')) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('- ')) {
        listItems.push(lines[i]!.trim().slice(2));
        i++;
      }

      blocks.push({
        id: generateId('cb'),
        type: 'list',
        content: listItems.join('\n'),
        children: listItems.map((item) => ({
          id: generateId('cb'),
          type: 'paragraph' as const,
          content: item,
        })),
      });
      continue;
    }

    // --- diagram instruction (special marker) ---
    if (line.trim().startsWith('[diagram]') || line.trim().startsWith('[DIAGRAM]')) {
      const diagramContent = line.trim().replace(/^\[diagram\]/i, '').trim();
      blocks.push({
        id: generateId('cb'),
        type: 'diagram_instruction',
        content: diagramContent,
      });
      i++;
      continue;
    }

    // --- paragraph (default) ---
    {
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i]!.trim().length > 0 &&
        !lines[i]!.trim().startsWith('#') &&
        !lines[i]!.trim().startsWith('```') &&
        !lines[i]!.trim().startsWith('$$') &&
        !lines[i]!.trim().startsWith('- ') &&
        !lines[i]!.trim().startsWith('[diagram]') &&
        !lines[i]!.trim().startsWith('[DIAGRAM]')
      ) {
        paraLines.push(lines[i]!.trim());
        i++;
      }

      const paragraphContent = paraLines.join(' ');

      if (summary.length === 0) {
        summary = paragraphContent;
      }

      blocks.push({
        id: generateId('cb'),
        type: 'paragraph',
        content: paragraphContent,
      });
    }
  }

  const totalReadTime = blocks.reduce((sum, block) => sum + calculateBlockDuration(block), 0);

  return {
    title,
    blocks,
    summary,
    estimatedReadTime: totalReadTime,
  };
}

// ---------------------------------------------------------------------------
// 5. explanationToBlocks
// ---------------------------------------------------------------------------

/**
 * Map from {@link ContentBlock#type} to the corresponding
 * {@link ExplanationBlock#type}.
 */
function mapContentTypeToExplanationType(
  contentType: ContentBlock['type'],
): ExplanationBlock['type'] {
  switch (contentType) {
    case 'code':
      return 'code';
    case 'equation':
      return 'equation';
    case 'diagram_instruction':
      return 'diagram';
    case 'heading':
    case 'paragraph':
    case 'list':
    default:
      return 'text';
  }
}

/**
 * Convert a {@link ParsedExplanation} into an ordered array of
 * {@link ExplanationBlock}s with durations calculated from content length.
 */
export function explanationToBlocks(parsed: ParsedExplanation): ExplanationBlock[] {
  return parsed.blocks.map((contentBlock, index) =>
    createExplanationBlock(
      mapContentTypeToExplanationType(contentBlock.type),
      contentBlock.content,
      index,
      calculateBlockDuration(contentBlock),
    ),
  );
}

// ---------------------------------------------------------------------------
// 7. createTextRevealState
// ---------------------------------------------------------------------------

/**
 * Create the initial {@link TextRevealState} for a given block. The revealed
 * length starts at 0 and `isComplete` is `false`.
 */
export function createTextRevealState(blockId: string, content: string): TextRevealState {
  return {
    blockId,
    revealedLength: 0,
    totalLength: content.length,
    isComplete: content.length === 0,
  };
}

// ---------------------------------------------------------------------------
// 8. advanceTextReveal
// ---------------------------------------------------------------------------

/**
 * Calculate the number of units (characters, words, or lines) to reveal per
 * millisecond based on the reveal {@link TextRevealConfig#mode} and
 * {@link TextRevealConfig#speed}.
 *
 * `speed` is interpreted as *units per second*:
 * - `character` mode → characters / second
 * - `word` mode      → words / second
 * - `line` mode      → lines / second
 * - `block` mode     → the entire block is revealed after `speed` ms
 */
function computeRevealIncrement(
  deltaMs: number,
  content: string,
  config: TextRevealConfig,
): number {
  switch (config.mode) {
    case 'character': {
      // speed = characters per second
      return Math.max(1, Math.round((config.speed * deltaMs) / 1000));
    }
    case 'word': {
      // speed = words per second → convert to characters
      const words = splitIntoWords(content);
      if (words.length === 0) return content.length;
      const avgWordLength = content.length / words.length;
      const wordsToReveal = (config.speed * deltaMs) / 1000;
      return Math.max(1, Math.round(wordsToReveal * avgWordLength));
    }
    case 'line': {
      // speed = lines per second → convert to characters
      const lines = splitIntoLines(content);
      if (lines.length === 0) return content.length;
      const avgLineLength = content.length / lines.length;
      const linesToReveal = (config.speed * deltaMs) / 1000;
      return Math.max(1, Math.round(linesToReveal * avgLineLength));
    }
    case 'block': {
      // speed is total duration in ms for the whole block
      if (config.speed <= 0) return content.length;
      const fraction = deltaMs / config.speed;
      return Math.max(1, Math.round(fraction * content.length));
    }
    default:
      return content.length;
  }
}

/**
 * Advance a {@link TextRevealState} forward by `deltaMs` milliseconds
 * according to the provided {@link TextRevealConfig}.
 *
 * A `delay` on the config is consumed first: the reveal does not begin until
 * `delay` ms of cumulative delta have passed.
 *
 * Returns a *new* state object (pure).
 */
export function advanceTextReveal(
  state: TextRevealState,
  deltaMs: number,
  config: TextRevealConfig,
  content: string,
): TextRevealState {
  if (state.isComplete || deltaMs <= 0) {
    return { ...state };
  }

  // If the state hasn't started revealing and there is a delay, consume it.
  let effectiveDelta = deltaMs;
  if (state.revealedLength === 0 && config.delay > 0) {
    if (effectiveDelta <= config.delay) {
      // Still within the initial delay; nothing to reveal yet.
      return { ...state };
    }
    effectiveDelta -= config.delay;
  }

  const increment = computeRevealIncrement(effectiveDelta, content, config);
  const newRevealed = Math.min(state.revealedLength + increment, state.totalLength);

  return {
    blockId: state.blockId,
    revealedLength: newRevealed,
    totalLength: state.totalLength,
    isComplete: newRevealed >= state.totalLength,
  };
}

// ---------------------------------------------------------------------------
// 9. getRevealedContent
// ---------------------------------------------------------------------------

/**
 * Return the visible portion of `content` based on the current
 * {@link TextRevealState}.
 *
 * In `word` and `line` modes the output snaps to the nearest word / line
 * boundary so that partial tokens are never shown.
 */
export function getRevealedContent(
  content: string,
  state: TextRevealState,
  mode: TextRevealConfig['mode'] = 'character',
): string {
  if (state.isComplete) {
    return content;
  }

  if (state.revealedLength <= 0) {
    return '';
  }

  switch (mode) {
    case 'block': {
      // Block mode: all or nothing.
      return state.isComplete ? content : '';
    }
    case 'word': {
      // Snap to the end of the last fully-revealed word.
      const sliced = content.slice(0, state.revealedLength);
      const lastSpace = sliced.lastIndexOf(' ');
      if (lastSpace === -1) {
        // Either the first word isn't fully typed or there are no spaces.
        return state.revealedLength >= content.indexOf(' ', 0) && content.indexOf(' ', 0) !== -1
          ? content.slice(0, content.indexOf(' ', 0))
          : sliced;
      }
      // Include up to the boundary of the last complete word
      return sliced;
    }
    case 'line': {
      // Snap to the end of the last fully-revealed line.
      const sliced = content.slice(0, state.revealedLength);
      const lastNewline = sliced.lastIndexOf('\n');
      if (lastNewline === -1) {
        return sliced;
      }
      return content.slice(0, state.revealedLength);
    }
    case 'character':
    default: {
      return content.slice(0, state.revealedLength);
    }
  }
}

// ---------------------------------------------------------------------------
// 10. calculateTransitionDelay
// ---------------------------------------------------------------------------

/**
 * Calculate the delay (ms) that should be inserted between two consecutive
 * blocks to give the viewer a natural pause.
 *
 * - A base delay is always applied.
 * - An extra delay is added when the block type changes.
 * - An additional bonus is added when transitioning to/from code blocks.
 */
export function calculateTransitionDelay(
  fromType: ExplanationBlock['type'],
  toType: ExplanationBlock['type'],
): number {
  let delay = BASE_TRANSITION_DELAY_MS;

  if (fromType !== toType) {
    delay += TYPE_CHANGE_TRANSITION_BONUS_MS;
  }

  if (fromType === 'code' || toType === 'code') {
    delay += CODE_TRANSITION_BONUS_MS;
  }

  return delay;
}
