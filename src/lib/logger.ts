import { createClient } from '@supabase/supabase-js';

// Internal backend client for logging (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Safely initialize client only if URL is present to prevent crashes in CI/Test
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type LogLevel = 'info' | 'warn' | 'error' | 'fatal';

interface LogOptions {
  level: LogLevel;
  context: string;
  message: string;
  error?: any;
  mediaId?: string;
}

class SystemLogger {
  private formatError(error: any): string | undefined {
    if (!error) return undefined;
    if (error instanceof Error) {
      return error.stack || error.message;
    }
    if (typeof error === 'object') {
      try {
        return JSON.stringify(error, null, 2);
      } catch (e) {
        return String(error);
      }
    }
    return String(error);
  }

  async log({ level, context, message, error, mediaId }: LogOptions) {
    // 1. Console Output for Dev/Vercel Logs
    const logPrefix = `[${level.toUpperCase()}] [${context}]`;
    if (level === 'error' || level === 'fatal') {
      console.error(logPrefix, message, error || '');
    } else if (level === 'warn') {
      console.warn(logPrefix, message, error || '');
    } else {
      console.log(logPrefix, message);
    }

    // 2. Persist to Supabase
    try {
      if (!supabase) return;
      
      await supabase.from('system_logs').insert({
        level,
        context,
        message,
        stack_trace: this.formatError(error),
        media_id: mediaId || null,
      });
    } catch (e) {
      // Fire and forget, don't crash the pipeline if logging fails
      console.error('[SystemLogger] Failed to write log to Supabase:', e);
    }
  }

  error(context: string, message: string, error?: any, mediaId?: string) {
    this.log({ level: 'error', context, message, error, mediaId });
  }

  warn(context: string, message: string, error?: any, mediaId?: string) {
    this.log({ level: 'warn', context, message, error, mediaId });
  }

  info(context: string, message: string, mediaId?: string) {
    this.log({ level: 'info', context, message, mediaId });
  }
}

export const logger = new SystemLogger();
