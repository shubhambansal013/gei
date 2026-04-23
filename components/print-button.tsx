'use client';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

/**
 * Thin wrapper around `window.print()`. Sibling elements with the
 * `print:hide` utility class (see `app/globals.css`) are hidden by
 * the browser's print CSS so only the current table or report
 * renders on paper/PDF.
 */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
