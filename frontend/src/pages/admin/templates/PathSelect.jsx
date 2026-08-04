import { useState } from 'react';

export default function PathSelect({ value, onChange, paths, onEdited }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query
    ? paths.filter((p) => p.toLowerCase().includes(query.toLowerCase()))
    : paths;

  return (
    <div className="relative flex-1">
      <input
        value={value}
        title={value || undefined}
        onChange={(e) => {
          onChange(e.target.value);
          onEdited?.();
          setOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={paths.length ? 'Type or pick a canonical path…' : 'Canonical path…'}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono focus:border-indigo-400 focus:outline-none"
      />
      {open && paths.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filtered.length === 0 && (
            <li className="px-2 py-1 text-xs text-gray-400">No matching paths</li>
          )}
          {filtered.map((p) => (
            <li
              key={p}
              title={p}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p);
                setOpen(false);
              }}
              className={`cursor-pointer px-2 py-1 font-mono text-xs hover:bg-indigo-50 ${
                p === value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
              }`}
            >
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
