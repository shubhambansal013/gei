'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/searchable-select';
import type { SearchableOption } from '@/components/searchable-select';
import { itemCreateSchema, itemUpdateSchema } from '@/lib/validators/item';
import type { ItemCreate, ItemUpdate } from '@/lib/validators/item';
import type { Database } from '@/lib/supabase/types';
import { createItem, updateItem } from './actions';

type ItemRow = Database['public']['Tables']['items']['Row'];
type CategoryRow = Database['public']['Tables']['item_categories']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];

type BaseProps = {
  categories: CategoryRow[];
  units: UnitRow[];
  onSuccess: () => void;
};

type Props = (BaseProps & { mode: 'create' }) | (BaseProps & { mode: 'edit'; item: ItemRow });

function buildUnitOptions(units: UnitRow[]): SearchableOption<string>[] {
  return units.map((u) => {
    const opt: SearchableOption<string> = { value: u.id, label: u.label };
    if (u.category != null) opt.group = u.category;
    return opt;
  });
}

function buildCategoryOptions(categories: CategoryRow[]): SearchableOption<string>[] {
  return [
    { value: '', label: '— None —' },
    ...categories.map<SearchableOption<string>>((c) => ({ value: c.id, label: c.label })),
  ];
}

/**
 * Shared item form. Renders create and edit modes; edit mode adds a
 * mandatory reason field to satisfy the audit requirement.
 */
export function ItemForm(props: Props) {
  const { mode, categories, units, onSuccess } = props;
  const isEdit = mode === 'edit';
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const unitOptions = buildUnitOptions(units);
  const categoryOptions = buildCategoryOptions(categories);

  // Cast schema to any to bypass @hookform/resolvers Zod v4 overload
  // type mismatch (same pattern used in site-form.tsx and party-form.tsx).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema: any = isEdit ? itemUpdateSchema : itemCreateSchema;

  const form = useForm<ItemCreate | ItemUpdate>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          id: props.item.id,
          name: props.item.name,
          code: props.item.code ?? '',
          stock_unit: props.item.stock_unit,
          category_id: props.item.category_id,
          hsn_code: props.item.hsn_code ?? '',
          reorder_level: props.item.reorder_level ?? undefined,
          reason: '',
        }
      : {
          name: '',
          code: '',
          stock_unit: '',
          category_id: 'ELECTRICAL',
          hsn_code: '',
          reorder_level: undefined,
        },
  });

  const { isSubmitting } = form.formState;
  const submitting = busy || isSubmitting;

  async function onSubmit(values: ItemCreate | ItemUpdate) {
    setBusy(true);
    try {
      const result = isEdit ? await updateItem(values) : await createItem(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? 'Item updated.' : 'Item created.');
      router.refresh();
      onSuccess();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Portland Cement 53 Grade"
                  maxLength={120}
                  {...field}
                  value={field.value as string}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. CEM-53"
                  className="font-mono uppercase"
                  pattern="[A-Za-z0-9_-]+"
                  maxLength={40}
                  {...field}
                  value={field.value as string}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="stock_unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stock unit *</FormLabel>
              <SearchableSelect
                options={unitOptions}
                value={(field.value as string) || null}
                onChange={field.onChange}
                placeholder="Select stock unit"
              />
              <FormDescription>Unit you track stock in (e.g. meter, kg).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={'category_id' as keyof (ItemCreate | ItemUpdate)}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <SearchableSelect
                options={categoryOptions}
                value={(field.value as string | null) ?? null}
                onChange={(v) => field.onChange(v === '' ? null : v)}
                placeholder="Select category (optional)"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={'hsn_code' as keyof (ItemCreate | ItemUpdate)}
          render={({ field }) => (
            <FormItem>
              <FormLabel>HSN Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. 2523"
                  maxLength={20}
                  {...field}
                  value={(field.value as string) ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={'reorder_level' as keyof (ItemCreate | ItemUpdate)}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reorder Level</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  placeholder="Optional"
                  {...field}
                  value={(field.value as number | null | undefined) ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEdit && (
          <FormField
            control={form.control}
            name={'reason' as keyof (ItemCreate | ItemUpdate)}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for edit *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Why is this change being made?"
                    {...field}
                    value={(field.value as string) ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create item'}
        </Button>
      </form>
    </Form>
  );
}
