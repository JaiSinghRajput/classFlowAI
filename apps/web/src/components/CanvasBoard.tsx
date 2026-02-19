'use client';

import { useRef, useCallback } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import type { DrawingState, Stroke } from '@classflowai/types';

interface CanvasBoardProps {
  width: number;
  height: number;
  drawingState: DrawingState;
  backgroundColor?: string;
}

export function CanvasBoard({
  width,
  height,
  drawingState,
  backgroundColor = '#0a0a0a',
}: CanvasBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const renderStroke = useCallback((stroke: Stroke, isActive: boolean = false) => {
    if (!stroke.points || stroke.points.length === 0) return null;
    
    const flatPoints = stroke.points.flatMap((p) => [p.x, p.y]);
    
    return (
      <Line
        key={stroke.id}
        points={flatPoints}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        opacity={isActive ? stroke.opacity : stroke.opacity}
        lineCap="round"
        lineJoin="round"
        tension={0.5}
        globalCompositeOperation="source-over"
      />
    );
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative rounded-lg overflow-hidden shadow-2xl"
      style={{ backgroundColor }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        style={{ backgroundColor }}
      >
        <Layer>
          {drawingState.strokes.map((stroke) => renderStroke(stroke, false))}
          {drawingState.activeStroke && renderStroke(drawingState.activeStroke, true)}
        </Layer>
      </Stage>
    </div>
  );
}