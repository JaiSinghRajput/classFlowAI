import type { ExplanationBlock, TimelineEvent } from '@classflowai/types';
import {
  parseRawExplanation,
  explanationToBlocks,
  calculateTransitionDelay,
  createTimelineEvent,
} from '@classflowai/engine';
import { logger } from '@classflowai/utils';
import { withRetry } from '../utils';
import * as lessonService from './lesson';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerationResult {
  explanation: ExplanationBlock[];
  timeline: TimelineEvent[];
  estimatedDuration: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Trigger full lesson generation for the given lesson ID.
 *
 * Updates the lesson status to `generating`, runs the content pipeline, and
 * on success sets the lesson to `ready`.  On failure the status is set to
 * `error`.
 *
 * Generation runs asynchronously — the returned promise resolves once the
 * lesson record has been updated.
 */
export async function generateLessonContent(lessonId: string): Promise<void> {
  const lesson = await lessonService.getLessonById(lessonId);
  if (!lesson) throw new Error(`Lesson not found: ${lessonId}`);

  await lessonService.updateLessonStatus(lessonId, 'generating');
  const startTime = Date.now();

  try {
    const rawExplanation = await withRetry(
      () => simulateLLMResponse(lesson.question),
      { maxRetries: 2, baseDelayMs: 300 },
    );

    const result = buildLessonFromRaw(rawExplanation);

    const generationTime = Date.now() - startTime;

    await lessonService.updateLessonContent(lessonId, result.explanation, result.timeline, {
      estimatedDuration: result.estimatedDuration,
      generationTime,
    });
    await lessonService.updateLessonStatus(lessonId, 'ready');

    logger.info('Lesson generation complete', {
      lessonId,
      blocks: result.explanation.length,
      events: result.timeline.length,
      durationMs: generationTime,
    });
  } catch (err) {
    await lessonService.updateLessonStatus(lessonId, 'error').catch(() => {});
    logger.error('Lesson generation failed', {
      lessonId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Parse a raw explanation string through the engine pipeline and produce
 * explanation blocks + timeline events.
 */
function buildLessonFromRaw(rawExplanation: string): GenerationResult {
  const parsed = parseRawExplanation(rawExplanation);
  const blocks = explanationToBlocks(parsed);
  const timeline = buildTimelineFromBlocks(blocks);
  const estimatedDuration = timeline.length > 0
    ? Math.max(...timeline.map((e) => e.endTime))
    : 0;

  return { explanation: blocks, timeline, estimatedDuration };
}

/**
 * Convert ordered explanation blocks into a sequential timeline of events.
 *
 * For each block the function creates:
 * - A `text_highlight` event spanning the block's duration.
 * - A `cursor_move` event showing cursor activity.
 * - A `narration_segment` event for audio narration.
 *
 * Transition delays between blocks are inserted automatically.
 */
function buildTimelineFromBlocks(blocks: ExplanationBlock[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let cursor = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;

    if (i > 0) {
      const prevBlock = blocks[i - 1]!;
      const delay = calculateTransitionDelay(prevBlock.type, block.type);
      cursor += delay;
    }

    const startTime = cursor;
    const endTime = cursor + block.duration;

    events.push(
      createTimelineEvent('text_highlight', startTime, endTime, {
        text: block.content,
      }),
    );

    events.push(
      createTimelineEvent('cursor_move', startTime, endTime, {
        position: { x: 100, y: 80 + block.order * 60 },
      }),
    );

    events.push(
      createTimelineEvent('narration_segment', startTime, endTime, {
        text: block.content,
      }),
    );

    cursor = endTime;
  }

  return events;
}

// ---------------------------------------------------------------------------
// LLM Simulation (replaced by real API in production)
// ---------------------------------------------------------------------------

/**
 * Simulate an LLM response for a given question.
 *
 * In production this function will call the configured LLM API with retry
 * logic.  The current implementation returns a structured Markdown
 * explanation so the full engine pipeline can be exercised.
 */
async function simulateLLMResponse(question: string): Promise<string> {
  await sleep(50);

  const topic = question.replace(/\?$/, '').trim();

  return [
    `# ${topic}`,
    '',
    `Let's explore this topic step by step. ${topic} is a fundamental concept that we can break down into clear, understandable parts.`,
    '',
    '## Key Concepts',
    '',
    `- The core idea behind ${topic.toLowerCase()} is built on foundational principles`,
    `- Understanding the underlying mechanics helps build intuition`,
    `- Practical applications reinforce theoretical knowledge`,
    '',
    '## Detailed Explanation',
    '',
    `To understand ${topic.toLowerCase()}, we start with the basics. Every complex concept is built from simpler building blocks that connect in meaningful ways.`,
    '',
    `The relationship between these components is what gives ${topic.toLowerCase()} its power and elegance. By examining each piece individually, we can see how they fit together.`,
    '',
    '## Summary',
    '',
    `In summary, ${topic.toLowerCase()} is a rich topic that combines several interrelated ideas. The key takeaway is that understanding the fundamentals provides a strong foundation for more advanced exploration.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
