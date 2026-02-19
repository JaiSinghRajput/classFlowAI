'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CreateLessonResponse {
  lessonId: string;
  status: 'pending' | 'generating';
  estimatedTime: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

export default function AskPage() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      const json: ApiResponse<CreateLessonResponse> = await response.json();

      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Failed to create lesson');
      }

      const { lessonId, status, estimatedTime } = json.data;

      if (status === 'pending') {
        const generateResponse = await fetch('/api/lessons/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId }),
        });

        const generateJson = await generateResponse.json();
        if (!generateJson.success) {
          throw new Error(generateJson.error?.message ?? 'Failed to start generation');
        }
      }

      router.push(`/lesson/${lessonId}?wait=${estimatedTime}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-8">
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
          ← Back to home
        </Link>

        <div className="text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Ask a Question
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Enter any question and watch the AI generate an interactive lesson
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is quantum entanglement?"
              disabled={isLoading}
              className="w-full h-40 p-4 bg-gray-900 border border-gray-700 rounded-xl 
                         text-white placeholder-gray-500 resize-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-lg"
              maxLength={2000}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-500">
              {question.length}/2000
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 
                       disabled:cursor-not-allowed text-white font-semibold rounded-xl
                       transition-all duration-200 text-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       focus:ring-offset-gray-900"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating Lesson...
              </span>
            ) : (
              'Generate Lesson'
            )}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm">
          Press Enter to submit • Shift+Enter for new line
        </p>
      </div>
    </main>
  );
}
