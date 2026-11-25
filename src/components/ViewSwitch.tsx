import { Eye, NotebookPen } from 'lucide-react';
import { cn } from '../lib/cn';
import { hrefFor } from '../lib/router';

/** The persistent switch between the seller's studio and the customer's view of the same program. */
export function ViewSwitch({ active }: { active: 'studio' | 'preview' }) {
  const items = [
    { id: 'studio' as const, label: 'Seller Studio', icon: <NotebookPen size={14} aria-hidden="true" /> },
    { id: 'preview' as const, label: 'Customer Preview', icon: <Eye size={14} aria-hidden="true" /> },
  ];
  return (
    <nav aria-label="Program view" className="inline-flex rounded-md border border-rule-strong bg-surface p-[3px]" data-testid="view-switch">
      {items.map((item) => (
        <a
          key={item.id}
          href={hrefFor(item.id)}
          aria-current={active === item.id ? 'page' : undefined}
          data-testid={`switch-${item.id}`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap no-underline transition-[background-color,color,box-shadow] duration-150',
            active === item.id ? 'bg-paper text-ink shadow-paper' : 'text-ink-2 hover:text-ink',
          )}
        >
          {item.icon}
          {item.label}
        </a>
      ))}
    </nav>
  );
}
