'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Lesson } from '@classflowai/types';
import { LessonPlayer } from '@/components';
import { useLessonStore } from '@/store/lesson-store';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

export default function LessonPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const lessonId = params.id as string;
  const waitTime = parseInt(searchParams.get('wait') ?? '0', 10);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setLessonId, reset } = useLessonStore();

  useEffect(() => {
    reset();
    setLessonId(lessonId);
  }, [lessonId, reset, setLessonId]);

  useEffect(() => {
    let isMounted = true;

    const fetchLesson = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/lessons/${lessonId}`);
        const json: ApiResponse<Lesson> = await response.json();

        if (!json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Lesson not found');
        }

        if (isMounted) {
          setLesson(json.data);
          
          if (json.data.status === 'generating' || json.data.status === 'pending') {
            const pollInterval = setInterval(async () => {
              const statusResponse = await fetch(`/api/lessons/${lessonId}`);
              const statusJson: ApiResponse<Lesson> = await statusResponse.json();
              
              if (statusJson.success && statusJson.data) {
                if (statusJson.data.status === 'ready') {
                  clearInterval(pollInterval);
                  setLesson(statusJson.data);
                  setIsLoading(false);
                } else if (statusJson.data.status === 'error') {
                  clearInterval(pollInterval);
                  setError('Lesson generation failed');
                  setIsLoading(false);
                }
              }
            }, 2000);

            return () => clearInterval(pollInterval);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load lesson');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (waitTime > 0) {
      setTimeout(() => {
        fetchLesson();
      }, waitTime);
    } else {
      fetchLesson();
    }

    return () => {
      isMounted = false;
    };
  }, [lessonId, waitTime]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-lg">Loading lesson...</p>
          {waitTime > 0 && (
            <p className="text-gray-500 text-sm">Please wait while we generate your lesson</p>
          )}
        </div>
      </main>
    );
  }

  if (error || !lesson) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto flex items-center justify-center bg-red-500/20 rounded-full">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Lesson Not Available</h1>
          <p className="text-gray-400">{error ?? 'Failed to load lesson'}</p>
          <Link
            href="/ask"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Create New Lesson
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 sm:p-8">
      <header className="flex items-center justify-between mb-6">
        <Link 
          href="/ask" 
          className="text-blue-400 hover:text-blue-300 text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          New Lesson
        </Link>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Question:</span>
          <span className="text-white font-medium max-w-md truncate">{lesson.question}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 text-xs font-medium rounded-full
            ${lesson.status === 'ready' ? 'bg-green-500/20 text-green-400' : 
              lesson.status === 'generating' ? 'bg-blue-500/20 text-blue-400' :
              lesson.status === 'error' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}
          >
            {lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}
          </span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center">
        <LessonPlayer lesson={lesson} />
      </div>
    </main>
  );
}