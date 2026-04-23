type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

/**
 * Standard empty-state card. Use in every list/table screen so users
 * never see a bare blank area. Always provide a `title`; optionally
 * `description` (explain why it's empty) and `action` (a button that
 * leads to the most likely next step).
 */
export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-white p-12 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-gray-600">{description}</p>}
      {action}
    </div>
  );
}
