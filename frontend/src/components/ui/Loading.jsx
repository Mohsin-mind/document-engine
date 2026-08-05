export default function Loading({ children = 'Loading…', className = '' }) {
  return <p className={`text-gray-500 ${className}`}>{children}</p>;
}