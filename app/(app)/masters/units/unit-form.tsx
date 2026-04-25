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
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/searchable-select';
import type { SearchableOption } from '@/components/searchable-select';
import { unitCreateSchema, unitUpdateSchema, UNIT_CATEGORIES } from '@/lib/validators/unit';
import type { UnitCategory, UnitCreate, UnitUpdate } from '@/lib/validators/unit';
import type { Database } from '@/lib/supabase/types';
import { createUnit, updateUnit } from './actions';

type UnitRow = Database['public']['Tables']['units']['Row'];

type BaseProps = {
  onSuccess: () => void;
};

type Props =
  | (BaseProps & { mode: 'create' })
  | (BaseProps & { mode: 'edit'; unit: UnitRow; onRequestDelete: () => void });

const CATEGORY_OPTIONS: SearchableOption<string>[] = [
  { value: '', label: '— None —' },
  ...UNIT_CATEGORIES.map<SearchableOption<string>>((c) => ({
    value: c,
    label: c.charAt(0).toUpperCase() + c.slice(1),
  })),
];

/**
 * Shared create/edit form for a `units` row. Edit mode locks the
 * `id` (it's the primary key and FK target from items/purchases) and
 * requires a reason to match the audit-trail convention used on
 * every other master form in this app.
 */
export function UnitForm(props: Props) {
  const { mode, onSuccess } = props;
  const isEdit = mode === 'edit';
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Same zodResolver-v4 overload workaround used in item-form.tsx / party-form.tsx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema: any = isEdit ? unitUpdateSchema : unitCreateSchema;

  const form = useForm<UnitCreate | UnitUpdate>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          id: props.unit.id,
          label: props.unit.label,
          // The DB column is free-text; coerce to the known enum or null.
          category:
            props.unit.category &&
            (UNIT_CATEGORIES as readonly string[]).includes(props.unit.category)
              ? (props.unit.category as UnitCategory)
              : null,
          reason: '',
        }
      : {
          id: '',
          label: '',
          category: null,
        },
  });

  const { isSubmitting } = form.formState;
  const submitting = busy || isSubmitting;

  async function onSubmit(values: UnitCreate | UnitUpdate) {
    setBusy(true);
    try {
      const result = isEdit ? await updateUnit(values) : await createUnit(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? 'Unit updated.' : 'Unit created.');
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
          name="id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Symbol *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. KG"
                  className="font-mono uppercase"
                  maxLength={16}
                  disabled={isEdit || submitting}
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
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Kilogram"
                  maxLength={80}
                  {...field}
                  value={(field.value as string | undefined) ?? ''}
                  disabled={submitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={'category' as keyof (UnitCreate | UnitUpdate)}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <SearchableSelect
                options={CATEGORY_OPTIONS}
                value={(field.value as string | null) ?? null}
                onChange={(v) => field.onChange(v === '' ? null : v)}
                placeholder="Select category (optional)"
                disabled={submitting}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {isEdit && (
          <FormField
            control={form.control}
            name={'reason' as keyof (UnitCreate | UnitUpdate)}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for edit *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Why is this change being made?"
                    {...field}
                    value={(field.value as string) ?? ''}
                    disabled={submitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={props.onRequestDelete}
              disabled={submitting}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create unit'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
