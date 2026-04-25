'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { siteCreateSchema, siteUpdateSchema } from '@/lib/validators/site';
import type { SiteCreate, SiteUpdate } from '@/lib/validators/site';
import type { Tables } from '@/lib/supabase/types';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { createSite, updateSite } from './actions';

type Site = Tables<'sites'>;

type CreateProps = {
  mode: 'create';
  onSuccess: () => void;
};

type EditProps = {
  mode: 'edit';
  site: Site;
  onSuccess: () => void;
};

type Props = CreateProps | EditProps;

/**
 * Shared form for creating and editing a site.
 *
 * In create mode the form renders code/name/type/address.
 * In edit mode the same fields are pre-populated and a mandatory
 * `reason` field is added to satisfy the audit requirement.
 *
 * Submitting dispatches to the matching server action and calls
 * `onSuccess` on a clean result so the parent can close a dialog.
 */
export function SiteForm(props: Props) {
  const isEdit = props.mode === 'edit';
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema: any = isEdit ? siteUpdateSchema : siteCreateSchema;

  const form = useForm<SiteCreate | SiteUpdate>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          id: props.site.id,
          code: props.site.code,
          name: props.site.name,
          type: props.site.type ?? '',
          address: props.site.address ?? '',
          reason: '',
        }
      : {
          code: '',
          name: '',
          type: '',
          address: '',
        },
  });

  const { isSubmitting } = form.formState;
  const submitting = busy || isSubmitting;

  async function onSubmit(values: SiteCreate | SiteUpdate) {
    setBusy(true);
    try {
      const result = isEdit ? await updateSite(values) : await createSite(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? 'Site updated.' : 'Site created.');
      router.refresh();
      props.onSuccess();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code *</FormLabel>
              <FormControl>
                <Input
                  placeholder="RGIPT-SIV"
                  className="font-mono uppercase"
                  pattern="[A-Za-z0-9-]+"
                  {...field}
                  value={field.value as string}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  disabled={submitting}
                />
              </FormControl>
              <FormDescription>e.g. RGIPT-SIV</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Site full name"
                  maxLength={120}
                  {...field}
                  value={field.value as string}
                  disabled={submitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <Input
                  placeholder="hostel, office, residential…"
                  {...field}
                  value={(field.value as string) ?? ''}
                  disabled={submitting}
                />
              </FormControl>
              <FormDescription>Free-form — e.g. hostel, office, residential</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Full postal address"
                  maxLength={500}
                  {...field}
                  value={(field.value as string) ?? ''}
                  disabled={submitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEdit && (
          <FormField
            control={form.control}
            name={'reason' as keyof (SiteCreate | SiteUpdate)}
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

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create site'}
        </Button>
      </form>
    </Form>
  );
}
