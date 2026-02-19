import mongoose from 'mongoose';
import { getConfig } from '../config';
import { connectToDatabase } from '../db';
import { LessonModel } from '../models/LessonModel';

const SAMPLE_QUESTIONS = [
  {
    question: 'What is a binary search tree?',
    subject: 'Computer Science',
    difficulty: 'intermediate' as const,
  },
  {
    question: 'How does React useEffect work?',
    subject: 'Web Development',
    difficulty: 'intermediate' as const,
  },
  {
    question: 'Explain the difference between REST and GraphQL',
    subject: 'API Design',
    difficulty: 'advanced' as const,
  },
];

async function seed(): Promise<void> {
  const config = getConfig();
  const uri = config.mongodbUri;

  if (!uri) {
    console.error('❌ MONGODB_URI not set');
    process.exit(1);
  }

  try {
    await connectToDatabase();
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }

  // Clear existing lessons
  await LessonModel.deleteMany({});
  console.log('🗑️  Cleared existing lessons');

  // Create sample lessons
  const lessons = await LessonModel.insertMany(
    SAMPLE_QUESTIONS.map((q) => ({
      userId: 'seed-user',
      question: q.question,
      explanation: [],
      timeline: [],
      status: 'ready' as const,
      metadata: {
        subject: q.subject,
        difficulty: q.difficulty,
        estimatedDuration: 60000,
        generationTime: 1000,
      },
    })),
  );

  console.log(`✅ Seeded ${lessons.length} lessons:`);
  lessons.forEach((lesson) => {
    console.log(`   - ${lesson.question} (${lesson._id})`);
  });

  await mongoose.connection.close();
  console.log('👋 MongoDB connection closed');
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
