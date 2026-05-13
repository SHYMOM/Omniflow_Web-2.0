import { cn } from '@/lib/utils/cn';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export default function LoadingSpinner({ size = 24, className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn('animate-spin rounded-full border-2 border-border border-t-accent-green', className)}
      style={{ width: size, height: size }}
    />
  );
}
