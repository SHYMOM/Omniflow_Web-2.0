import { cn } from '@/lib/utils/cn';

interface TypeBadgeProps {
  label: string;
  variant?: 'default' | 'green' | 'gold' | 'red';
  size?: 'sm' | 'md';
  className?: string;
}

export default function TypeBadge({ label, variant = 'default', size = 'sm', className }: TypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        variant === 'default' && 'bg-badge text-white',
        variant === 'green' && 'bg-accent-green text-black font-bold',
        variant === 'gold' && 'bg-accent-gold text-black font-bold',
        variant === 'red' && 'bg-accent-red text-white font-bold',
        className
      )}
    >
      {label}
    </span>
  );
}
