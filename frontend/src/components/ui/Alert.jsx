const VARIANTS = {
  error: 'bg-red-50 border-red-200 text-red-700',
  success: 'bg-green-50 border-green-200 text-green-700',
  warn: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

export default function Alert({ variant = 'info', className = '', children, ...props }) {
  return (
    <div className={`rounded-md border px-4 py-2 text-sm ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}