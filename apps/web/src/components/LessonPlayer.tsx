'use client';

import { useEffect, useRef, useCallback } from 'react';
import { LessonPlaybackEngine } from '@classflowai/engine';
import type { TimelineTrack, PlaybackSnapshot, Lesson } from '@classflowai/types';
import { useLessonStore } from '@/store/lesson-store';
import { CanvasBoard } from './CanvasBoard';
import { CursorLayer } from './CursorLayer';
import { TimelineController } from './TimelineController';

interface LessonPlayerProps {
  lesson: Lesson;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const getTrackTypeForEvent = (eventType: string): string => {
  switch (eventType) {
    case 'cursor_move': return 'cursor';
    case 'draw_stroke': return 'drawing';
    case 'text_highlight': return 'text';
    case 'narration_segment': return 'narration';
    default: return 'text';
  }
};

export function LessonPlayer({ lesson }: LessonPlayerProps) {
  const engineRef = useRef<LessonPlaybackEngine | null>(null);
  const { 
    engineState, 
    cursorState, 
    drawingState, 
    progress,
    updateSnapshot 
  } = useLessonStore();

  const buildTracksFromLesson = useCallback((): TimelineTrack[] => {
    const tracksByType = new Map<string, TimelineTrack>();
    
    for (const event of lesson.timeline) {
      const type = getTrackTypeForEvent(event.type);
      if (!tracksByType.has(type)) {
        tracksByType.set(type, {
          id: `track-${type}`,
          type: type as TimelineTrack['type'],
          events: [],
          locked: false,
          visible: true,
        });
      }
      tracksByType.get(type)!.events.push(event);
    }

    return Array.from(tracksByType.values());
  }, [lesson.timeline]);

  useEffect(() => {
    if (!lesson || !lesson.timeline.length) return;

    const engine = new LessonPlaybackEngine({
      targetFps: 60,
      maxDeltaMs: 100,
      autoPlay: false,
    });

    const tracks = buildTracksFromLesson();
    engine.load(tracks);

    engine.on('frame', (snapshot: PlaybackSnapshot) => {
      updateSnapshot(snapshot);
    });

    engine.startLoop();

    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [lesson.id, buildTracksFromLesson, updateSnapshot]);

  const handlePlay = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const handleSeek = useCallback((time: number) => {
    engineRef.current?.seek(time);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    engineRef.current?.setSpeed(speed);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Canvas Area */}
      <div className="relative aspect-video w-full max-w-4xl mx-auto">
        <CanvasBoard
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          drawingState={drawingState}
        />              <CursorLayer cursorState={cursorState} />
      </div>

      {/* Timeline Controller */}
      <div className="w-full max-w-2xl mx-auto">
        <TimelineController
          engineState={engineState}
          progress={progress}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          onSpeedChange={handleSpeedChange}
        />
      </div>
    </div>
  );
}