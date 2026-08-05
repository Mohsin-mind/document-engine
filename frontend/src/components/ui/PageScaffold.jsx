export default function PageScaffold({
  title,
  subtitle,
  actions,
  toolbar,
  containerClassName = 'max-w-4xl',
  children,
}) {
  return (
    <div className={`flex h-full flex-col ${containerClassName}`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </div>
      {toolbar ? <div className="mb-3 shrink-0">{toolbar}</div> : null}
      <div className="isolate -mx-8 min-h-0 flex-1 overflow-y-auto px-8 pb-8">{children}</div>
    </div>
  );
}