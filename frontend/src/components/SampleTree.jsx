export function valueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null || value === undefined) return 'empty';
  const t = typeof value;
  if (t === 'boolean') return 'boolean';
  if (t === 'number') return 'number';
  if (t === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'string';
  }
  return 'object';
}

const BADGE_STYLES = {
  string: 'bg-sky-50 text-sky-700 ring-sky-200',
  date: 'bg-violet-50 text-violet-700 ring-violet-200',
  number: 'bg-amber-50 text-amber-700 ring-amber-200',
  boolean: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  array: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  object: 'bg-gray-50 text-gray-600 ring-gray-200',
  empty: 'bg-gray-100 text-gray-400 ring-gray-200',
};

export function TypeBadge({ value, label }) {
  const t = valueType(value);
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${BADGE_STYLES[t] || BADGE_STYLES.empty}`}
    >
      {label || t}
    </span>
  );
}

function LeafRow({ label, value, depth }) {
  return (
    <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${depth * 1.25}rem` }}>
      <span className="text-xs text-gray-700 font-medium">{label}</span>
      <TypeBadge value={value} />
      <span className="text-xs font-mono text-gray-500 truncate">{String(value)}</span>
    </div>
  );
}

function Node({ label, value, depth }) {
  if (Array.isArray(value)) {
    const item = value[0];
    return (
      <div>
        <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          <span className="text-xs text-gray-700 font-medium">{label}[]</span>
          <TypeBadge value={value} />
          <span className="text-[11px] text-gray-400">{value.length} item{value.length === 1 ? '' : 's'}</span>
        </div>
        {item && typeof item === 'object' && (
          <div>
            {Object.entries(item).map(([k, v]) => (
              <Node key={k} label={k} value={v} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <div>
        <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          <span className="text-xs font-semibold text-gray-800">{label}</span>
          <TypeBadge value={value} />
        </div>
        <div>
          {Object.entries(value).map(([k, v]) => (
            <Node key={k} label={k} value={v} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }
  return <LeafRow label={label} value={value} depth={depth} />;
}

export default function SampleTree({ value, title, rename = {} }) {
  if (value == null || typeof value !== 'object') {
    return <p className="text-xs text-gray-400">No sample yet.</p>;
  }
  return (
    <div className="rounded-md border border-gray-100 bg-white p-2 max-h-72 overflow-auto">
      {title && <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1">{title}</p>}
      {Object.entries(value).map(([k, v]) => (
        <Node key={k} label={rename[k] || k} value={v} depth={0} />
      ))}
    </div>
  );
}
