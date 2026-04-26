'use client';
import { useState } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchableOption<V extends string = string> = {
  value: V;
  label: string;
  sub?: string;
  group?: string | null;
};

type Props<V extends string> = {
  options: SearchableOption<V>[];
  value: V | null;
  onChange: (v: V | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  id?: string | undefined;
};

/**
 * Accessible typeahead select. Groups options by `group` when provided.
 *
 * Keyboard:
 *   - Click or press Enter on the trigger to open
 *   - Type to filter
 *   - Arrow keys to navigate matches
 *   - Enter to select, Esc to close
 *
 * Uses shadcn/ui `base-nova` primitives (@base-ui/react under the hood).
 * The trigger is a `div` to avoid button-in-button nesting when the
 * `clearable` 'X' is present.
 */
export function SearchableSelect<V extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  clearable,
  id,
}: Props<V>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const grouped = options.reduce<Record<string, SearchableOption<V>[]>>((acc, o) => {
    const k = o.group ?? '';
    (acc[k] ??= []).push(o);
    return acc;
  }, {});

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <div
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-label={selected ? selected.label : (placeholder ?? 'Select')}
            tabIndex={disabled ? -1 : 0}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            )}
            onClick={() => !disabled && setOpen(true)}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            <div className="flex items-center gap-2 truncate">
              {selected ? (
                <span>{selected.label}</span>
              ) : (
                <span className="text-muted-foreground">{placeholder ?? 'Select'}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {clearable && value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </div>
        }
      />
      <PopoverContent className="w-(--anchor-width) p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            {Object.entries(grouped).map(([group, list]) => (
              <CommandGroup key={group} heading={group || undefined}>
                {list.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.sub ?? ''}`}
                    onSelect={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === o.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{o.label}</span>
                      {o.sub && <span className="text-xs text-gray-500">{o.sub}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
