import { clsx } from 'clsx';

const VARIANTS: Record<string, string> = {
  new: 'bg-gray-700 text-gray-300',
  prospecting: 'bg-orange-900/50 text-orange-400',
  waiting: 'bg-yellow-900/50 text-yellow-400',
  engaged: 'bg-purple-900/50 text-purple-400',
  qualified: 'bg-green-900/50 text-green-400',
  unresponsive: 'bg-red-900/50 text-red-400',
  nurture: 'bg-blue-900/50 text-blue-400',
  won: 'bg-green-600 text-white',
  lost: 'bg-red-600 text-white',
  cold: 'bg-blue-900/50 text-blue-400',
  warm: 'bg-yellow-900/50 text-yellow-400',
  hot: 'bg-red-900/50 text-red-400',
};

export function Badge({ label, variant }: { label: string; variant?: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', VARIANTS[variant || label] || 'bg-gray-700 text-gray-300')}>
      {label}
    </span>
  );
}
