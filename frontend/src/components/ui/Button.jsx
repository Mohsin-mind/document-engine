const VARIANTS = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700 font-medium',
  success: 'bg-green-700 text-white hover:bg-green-600 font-medium',
  indigo: 'bg-indigo-700 text-white hover:bg-indigo-600 font-medium',
  outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  outlineDanger: 'border border-red-200 text-red-600 hover:bg-red-50',
  outlineIndigo: 'border border-indigo-300 text-indigo-700 hover:bg-indigo-50',
  dashed: 'border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50',
  dashedIndigo: 'border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50',
  link: 'hover:underline disabled:opacity-50',
};

const SIZES = {
  xxs: 'px-2 py-1 text-xs',
  xs: 'px-3 py-1 text-xs',
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2 text-sm',
  none: '',
};

export default function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1 rounded-md transition-colors focus:outline-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}