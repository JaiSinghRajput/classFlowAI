'use client';

import { useCallback } from 'react';
import type { EngineState } from '@classflowai/types';

interface TimelineControllerProps {
  engineState: EngineState;
  progress: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
}

export function TimelineController({
  engineState,
  progress,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
}: TimelineControllerProps) {
  const { isPlaying, currentTime, duration, playbackRate, status } = engineState;

  const formatTime = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const newTime = percentage * duration;
      onSeek(newTime);
    },
    [duration, onSeek],
  );

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const isLoading = status === 'loading' || status === 'idle';
  const isReady = status !== 'loading' && status !== 'idle';

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700">
      {/* Progress Bar */}
      <div
        className="relative h-2 bg-gray-700 rounded-full cursor-pointer group"
        onClick={handleProgressClick}
      >
        <div
          className="absolute h-full bg-blue-500 rounded-full transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress * 100}% - 8px)` }}
        />
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-sm text-gray-400 font-mono">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={isLoading || !isReady}
          className="w-14 h-14 flex items-center justify-center bg-blue-600 hover:bg-blue-500 
                     disabled:bg-gray-700 disabled:cursor-not-allowed rounded-full
                     transition-all duration-200 shadow-lg hover:shadow-blue-500/25
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     focus:ring-offset-gray-900"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : isPlaying ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Speed Control */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-gray-500">Speed:</span>
        <div className="flex gap-1">
          {speedOptions.map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              disabled={playbackRate === speed}
              className={`px-3 py-1 text-sm rounded-md transition-colors
                ${playbackRate === speed 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                } disabled:cursor-not-allowed`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex justify-center">
        <span className={`px-3 py-1 text-xs font-medium rounded-full
          ${status === 'playing' ? 'bg-green-500/20 text-green-400' : 
            status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
            status === 'loading' ? 'bg-blue-500/20 text-blue-400' :
            status === 'error' ? 'bg-red-500/20 text-red-400' :
            'bg-gray-500/20 text-gray-400'
          }`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    </div>
  );
}