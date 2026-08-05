const TONES = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-500',
  indigo: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
};

const SIZES = {
  sm: 'px-2 py-0.5',
  md: 'px-3 py-1',
};

export default function Badge({ tone = 'gray', size = 'sm', className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full text-xs font-medium ${SIZES[size]} ${TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, size }) {
  return (
    <Badge size={size} tone={status === 'published' ? 'green' : 'amber'}>
      {status}
    </Badge>
  );
}