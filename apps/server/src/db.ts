import mongoose from 'mongoose';
import { getConfig } from './config';

let cached: typeof mongoose | null = null;

/**
 * Establish connection to MongoDB using MONGODB_URI from environment.
 * Uses singleton pattern to avoid multiple connections.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached) {
    return cached;
  }

  const config = getConfig();
  const uri = config.mongodbUri;

  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });

    console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);

    // Graceful shutdown
    mongoose.connection.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    cached = conn;
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Get the current Mongoose connection instance.
 */
export function getDbConnection(): typeof mongoose {
  return mongoose;
}
