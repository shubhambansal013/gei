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
import { Button, buttonVariants } from '@/components/ui/button';
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
  clearable?: boolean | undefined;
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
 * Uses shadcn/ui `base-nova` primitives (@base-ui/react under the hood),
 * so `PopoverTrigger` takes a `render={<Button .../>}` prop rather than
 * Radix's `asChild` pattern.
 */
export function SearchableSelect<V extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  clearable = false,
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
            role="combobox"
            aria-label={placeholder}
            aria-expanded={open}
            tabIndex={disabled ? undefined : 0}
            onClick={() => !disabled && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'w-full justify-between cursor-pointer font-normal',
              disabled && 'pointer-events-none opacity-50',
            )}
          >
            <div className="flex flex-1 items-center justify-between min-w-0">
              {selected ? (
                <span className="truncate">{selected.label}</span>
              ) : (
                <span className="text-gray-400 truncate">{placeholder ?? 'Select'}</span>
              )}
              {selected && !disabled && clearable && (
                <div
                  role="button"
                  aria-label="Clear selection"
                  tabIndex={0}
                  className="ml-auto p-0.5 rounded-sm hover:bg-muted-foreground/10 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(null);
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
                </div>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
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
