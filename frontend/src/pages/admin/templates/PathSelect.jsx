import { useEffect, useMemo, useRef, useState } from 'react';
import { valueType, TypeBadge } from '../../../components/SampleTree.jsx';

function toNodes(value, prefix = '', rename = {}) {
  if (Array.isArray(value)) {
    const p = prefix ? `${prefix}[]` : '[]';
    const item = value[0];
    const children =
      item && typeof item === 'object'
        ? Object.entries(item).map(([k, v]) => toNode(k, v, p, rename)).flat()
        : [];
    return [{ key: '[]', path: p, type: 'array', value, children }];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([k, v]) => toNode(k, v, prefix, rename)).flat();
  }
  return [];
}

function toNode(key, value, prefix, rename = {}) {
  const path = prefix ? `${prefix}.${key}` : key;
  const display = prefix ? key : rename[key] || key;
  if (Array.isArray(value)) {
    const arrPath = `${path}[]`;
    const one = value[0];
    const children =
      one && typeof one === 'object'
        ? Object.entries(one).map(([k, vi]) => toNode(k, vi, arrPath, rename)).flat()
        : [];
    return [{ key: `${display}[]`, path: arrPath, type: 'array', value, children }];
  }
  if (value && typeof value === 'object') {
    return [{ key: display, path, type: 'object', value, children: toNodes(value, path, rename) }];
  }
  return [{ key: display, path, type: valueType(value), value }];
}

const valueText = (v) => {
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`;
  if (v === null || v === undefined) return '';
  return String(v);
};

export default function PathSelect({ value, onChange, paths, canonical, rename = {} }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

    const renameSegment = (p) => {
    const m = /^([^.[]+)(\[\])?/.exec(String(p || ''));
    if (!m) return p;
    const [, id, brackets] = m;
    if (!rename[id]) return p;
    return rename[id] + (brackets || '') + String(p).slice(m[0].length);
  };

  const reverseRename = useMemo(() => {
    const r = {};
    for (const [id, label] of Object.entries(rename)) if (label) r[label] = id;
    return r;
  }, [rename]);

  const toRealPath = (p) => {
    const m = /^([^.[]+)(\[\])?/.exec(String(p || ''));
    if (!m) return p;
    const [, label, brackets] = m;
    if (!reverseRename[label]) return p;
    return reverseRename[label] + (brackets || '') + String(p).slice(m[0].length);
  };

  const displayValue = renameSegment(value);

  const tree = useMemo(() => {
    if (canonical && typeof canonical === 'object' && !Array.isArray(canonical)) {
      return toNodes(canonical, '', rename);
    }
    return paths.map((p) => ({ key: renameSegment(p), path: p, type: 'leaf', value: p, children: [] }));
  }, [canonical, paths, rename]);

  const selectedPath = String(value || '').replace(/\[\d+\]/g, '[]');

  // Close on any pointer press outside the component (document-level listener).
  // This is the pattern headless dropdown libraries use — it never depends on
  // focus/blur timing, so focus moving to the filter box or a row cannot close
  // the menu by mistake.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const commit = (node) => {
    onChange(node.path);
    setOpen(false);
  };

  const matchesQuery = (node) => {
    const q = query.toLowerCase();
    if (!q) return true;
    if (node.path.toLowerCase().includes(q)) return true;
    if (node.key.toLowerCase().includes(q)) return true;
    return (node.children || []).some(matchesQuery);
  };

  const renderRows = (nodes, depth) => {
    const out = [];
    for (const node of nodes) {
      if (!matchesQuery(node)) continue;
      if (query && !node.path.toLowerCase().includes(query.toLowerCase()) && !node.key.toLowerCase().includes(query.toLowerCase())) {
        out.push(renderRows(node.children || [], depth));
        continue;
      }
      const isBranch = node.type === 'object' || node.type === 'array';
      const selectable = !isBranch || node.type === 'array';
      const selected = selectedPath === node.path;
      out.push(
        <li key={node.path}>
          <button
            type="button"
            title={node.type === 'object' ? `${node.path} (expand)` : node.path}
            onClick={() => selectable && commit(node)}
            className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left font-mono text-xs ${
              selected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
            } ${selectable ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ paddingLeft: `${0.75 + depth * 1.1}rem` }}
          >
            {isBranch ? (
              <span className="text-gray-400">{node.type === 'array' ? '▸' : '▾'}</span>
            ) : (
              <span className="text-gray-300">·</span>
            )}
            <span className="truncate">{node.key}</span>
            <TypeBadge value={node.value} label={node.type === 'leaf' ? 'path' : node.type} />
            <span className="ml-auto truncate text-[10px] text-gray-400">{valueText(node.value)}</span>
          </button>
          {!query && isBranch && renderRows(node.children || [], depth + 1)}
        </li>
      );
    }
    return out;
  };

  const visible = query ? tree.filter(matchesQuery) : tree;

  return (
    <div className="relative flex-1" ref={wrapRef}>
      <input
        value={displayValue}
        title={value || undefined}
        onChange={(e) => {
          onChange(toRealPath(e.target.value));
          setOpen(true);
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
        }}
        placeholder={tree.length ? 'Type or pick a canonical field…' : 'Canonical path…'}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono focus:border-indigo-400 focus:outline-none"
      />
      {open && visible.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="sticky top-0 border-b border-gray-100 bg-white p-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter fields…"
              className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
            />
          </div>
          <ul className="p-1">{renderRows(visible, 0)}</ul>
        </div>
      )}
    </div>
  );
}