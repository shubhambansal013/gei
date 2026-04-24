'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
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
import { locationUnitCreateSchema, locationUnitUpdateSchema } from '@/lib/validators/location';
import type { LocationUnitCreate, LocationUnitUpdate } from '@/lib/validators/location';
import { createUnit, updateUnit } from './actions';

type SiteOption = { id: string; code: string; name: string };
type TypeOption = { id: string; label: string };

type CreateMode = {
  mode: 'create';
  sites: SiteOption[];
  types: TypeOption[];
  onSuccess?: () => void;
};

type EditMode = {
  mode: 'edit';
  sites: SiteOption[];
  types: TypeOption[];
  defaultValues: {
    id: string;
    site_id: string;
    name: string;
    code: string;
    type: string;
  };
  onSuccess?: () => void;
};

type Props = CreateMode | EditMode;

export function LocationForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  const schema = isEdit ? locationUnitUpdateSchema : locationUnitCreateSchema;

  const form = useForm<LocationUnitCreate | LocationUnitUpdate>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: isEdit
      ? {
          id: props.defaultValues.id,
          site_id: props.defaultValues.site_id,
          name: props.defaultValues.name,
          code: props.defaultValues.code,
          type: props.defaultValues.type,
          reason: '',
        }
      : {
          site_id: props.sites[0]?.id ?? '',
          name: '',
          code: '',
          type: '',
        },
  });

  const { isSubmitting } = form.formState;

  const siteOptions = props.sites.map((s) => ({
    value: s.id,
    label: `${s.code} — ${s.name}`,
  }));
  const typeOptions = props.types.map((t) => ({ value: t.id, label: t.label }));

  async function onSubmit(values: LocationUnitCreate | LocationUnitUpdate) {
    const res = isEdit ? await updateUnit(values) : await createUnit(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(isEdit ? 'Location updated.' : 'Location created.');
    router.refresh();
    props.onSuccess?.();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="site_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Site *</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={siteOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select site"
                  disabled={isEdit}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Block A" maxLength={120} {...field} />
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
                    placeholder="e.g. BA"
                    maxLength={20}
                    className="font-mono uppercase"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type *</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={typeOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select type"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEdit && (
          <FormField
            control={form.control}
            name={'reason' as keyof (LocationUnitCreate | LocationUnitUpdate)}
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

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create location'}
        </Button>
      </form>
    </Form>
  );
}
