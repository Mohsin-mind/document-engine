export default function DataTable({ columns, children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-gray-200 bg-white ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className={`px-4 py-3 font-medium text-gray-600 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ align, className = '', children, ...props }) {
  return (
    <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : ''} ${className}`} {...props}>
      {children}
    </td>
  );
}