import { NavLink, Outlet } from 'react-router-dom';

const nav = [
  { section: 'Admin Mode', items: [
    { to: '/admin/question-sets', label: 'Question Sets' },
    { to: '/admin/rules', label: 'Rules' },
    { to: '/admin/templates', label: 'Templates' },
  ]},
  { section: 'Customer Simulation', items: [
    { to: '/simulation', label: 'Questionnaire' },
    { to: '/review', label: 'Review' },
    { to: '/downloads', label: 'Downloads' },
  ]},
];

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-700">
          <h1 className="font-bold text-lg">Document Engine</h1>
          <p className="text-xs text-slate-400">Legal Document Platform</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-6">
          {nav.map((group) => (
            <div key={group.section}>
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {group.section}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
