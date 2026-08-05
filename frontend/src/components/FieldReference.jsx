export function flattenValues(value, prefix = '', out = []) {
  if (Array.isArray(value)) {
    const p = prefix ? `${prefix}[]` : '[]';
    if (value.length && value[0] && typeof value[0] === 'object') {
      flattenValues(value[0], p, out);
    } else {
      out.push({ path: p, value: value.length ? value[0] : '' });
    }
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      flattenValues(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  out.push({ path: prefix, value: value === null || value === undefined ? '' : value });
  return out;
}

export default function FieldReference({ title = 'Field reference', sections }) {
  const list = (sections || []).filter((s) => s && Array.isArray(s.rows) && s.rows.length > 0);
  if (list.length === 0) return null;
  const count = list.reduce((n, s) => n + s.rows.length, 0);
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
        {title} ({count})
      </summary>
      <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
        {list.map((s, i) => (
          <div key={i}>
            <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">{s.title}</p>
            <div className="space-y-0.5">
              {s.rows.map((r, j) => (
                <div key={`${r.id}-${j}`} className="flex items-center gap-3 text-[11px]">
                  <span className="flex-1 truncate text-gray-700" title={r.label}>
                    {r.label}
                  </span>
                  {r.extra && (
                    <span className="truncate text-gray-400 max-w-40 font-mono">{r.extra}</span>
                  )}
                  {r.path && r.path !== r.label && (
                    <code className="w-40 shrink-0 truncate text-right font-mono text-indigo-600" title={r.path}>
                      {r.path}
                    </code>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}