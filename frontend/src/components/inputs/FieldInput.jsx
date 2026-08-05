import { Input, Select } from '../ui/index.jsx';

function errorClass(error) {
  return error ? 'border-red-400 focus:ring-red-200' : '';
}

export default function FieldInput({ field, value, onChange, error }) {
  const label = field.label || field.id;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <Input
        size="md"
        className={`w-full ${errorClass(error)}`}
        type={field.type}
        value={value ?? ''}
        onChange={(e) => onChange(field.type === 'number' ? e.target.valueAsNumber || '' : e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function SelectInput({ field, value, onChange, error }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label || field.id} {field.required && <span className="text-red-500">*</span>}
      </label>
      <Select
        size="md"
        className={`w-full ${errorClass(error)}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      >
        <option value="">— select —</option>
        {field.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function RadioInput({ field, value, onChange, error, options = ['yes', 'no'] }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label || field.id} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-4">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={field.name || field.id}
              checked={value === o}
              onChange={() => onChange(o)}
            />
            {o}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function CheckboxGroup({ field, value, onChange, error }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label || field.id} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex flex-wrap gap-4">
        {field.options.map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(o)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, o] : selected.filter((x) => x !== o))
              }
            />
            {o}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function FieldRenderer({ field, value, onChange, error }) {
  switch (field.type) {
    case 'dropdown':
      return <SelectInput field={field} value={value} onChange={onChange} error={error} />;
    case 'yesno':
      return <RadioInput field={field} value={value} onChange={onChange} error={error} />;
    case 'checkbox':
      return <CheckboxGroup field={field} value={value} onChange={onChange} error={error} />;
    default:
      return <FieldInput field={field} value={value} onChange={onChange} error={error} />;
  }
}
