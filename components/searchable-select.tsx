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
import { ChevronsUpDown, Check } from 'lucide-react';
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
  onChange: (v: V) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
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
        render={
          <Button
            id={id}
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            variant="outline"
            className="w-full justify-between"
          >
            {selected ? (
              selected.label
            ) : (
              <span className="text-gray-400">{placeholder ?? 'Select'}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
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
