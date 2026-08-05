export const SIZE_CLASS = {
  sm: 'rounded border border-gray-300 px-2 py-1 text-xs',
  field: 'rounded border border-gray-300 px-2 py-1 text-sm',
  md: 'rounded-md border border-gray-300 px-3 py-2 text-sm',
};

export default function Input({ size = 'sm', className = '', ...props }) {
  return <input className={`${SIZE_CLASS[size]} ${className}`} {...props} />;
}

export function Select({ size = 'sm', className = '', ...props }) {
  return <select className={`${SIZE_CLASS[size]} ${className}`} {...props} />;
}

export function Textarea({ size = 'md', className = '', ...props }) {
  return <textarea className={`${SIZE_CLASS[size]} ${className}`} {...props} />;
}