import Link from 'next/link';
import { FileText } from 'lucide-react';

type Props = {
  title: string;
  plan: string;
  planPath: string;
  description: string;
  features: string[];
};

/**
 * Placeholder used for routes that the sidebar links to but the
 * respective plan hasn't shipped yet. Keeps navigation from dead-ending
 * at a 404 and tells a curious user where the work is tracked.
 */
export function ComingSoon({ title, plan, planPath, description, features }: Props) {
  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
          Coming in {plan}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </header>

      <section className="bg-card rounded-md border p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">What will land here</h2>
        <ul className="text-muted-foreground space-y-1.5 text-sm">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs"
      >
        <FileText className="h-3.5 w-3.5" />
        <span>
          Plan: <code className="font-mono">{planPath}</code>
        </span>
      </Link>
    </div>
  );
}
