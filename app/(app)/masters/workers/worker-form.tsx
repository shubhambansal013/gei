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
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/searchable-select';
import {
  EMPLOYMENT_TYPES,
  workerCreateSchema,
  workerUpdateSchema,
  type WorkerCreate,
  type WorkerUpdate,
} from '@/lib/validators/worker';
import { createWorker, updateWorker } from './actions';

type SiteOption = { id: string; name: string; code: string };
type PartyOption = { id: string; name: string; short_code: string | null; type: string };

type CreateProps = {
  mode: 'create';
  sites: SiteOption[];
  parties: PartyOption[];
  defaultSiteId?: string | null;
  onSuccess: () => void;
};

type EditProps = {
  mode: 'edit';
  defaultValues: {
    id: string;
    full_name: string;
    phone: string | null;
    home_city: string | null;
    is_active: boolean;
  };
  onSuccess: () => void;
};

type Props = CreateProps | EditProps;

const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  DIRECT: 'Direct',
  CONTRACTOR_EMPLOYEE: 'Contractor employee',
  SUBCONTRACTOR_LENT: 'Sub-contractor (lent)',
};

/**
 * Create + edit form for a Worker. Create mode opens the first
 * SiteAssignment + Affiliation transparently in the server action.
 * Edit mode only patches name/phone/city/active — transfers and
 * affiliation changes go through dedicated dialogs so history is
 * correctly closed+opened.
 */
export function WorkerForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolver = zodResolver((isEdit ? workerUpdateSchema : workerCreateSchema) as any);

  const form = useForm<WorkerCreate | WorkerUpdate>({
    resolver,
    defaultValues: isEdit
      ? {
          id: props.defaultValues.id,
          full_name: props.defaultValues.full_name,
          phone: props.defaultValues.phone ?? '',
          home_city: props.defaultValues.home_city ?? '',
          is_active: props.defaultValues.is_active,
        }
      : {
          full_name: '',
          phone: '',
          home_city: '',
          current_site_id: props.defaultSiteId ?? '',
          employment_type: 'DIRECT',
          contractor_party_id: null,
        },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: WorkerCreate | WorkerUpdate) {
    try {
      const res = isEdit ? await updateWorker(values) : await createWorker(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? 'Worker updated.' : 'Worker created.');
      router.refresh();
      props.onSuccess();
    } catch (e) {
      console.error(e);
      toast.error(isEdit ? 'Failed to update worker.' : 'Failed to create worker.');
    }
  }

  if (isEdit) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name *</FormLabel>
                <FormControl>
                  <Input maxLength={120} {...field} value={(field.value as string) ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input maxLength={20} {...field} value={(field.value as string) ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="home_city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Home city</FormLabel>
                <FormControl>
                  <Input maxLength={80} {...field} value={(field.value as string) ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </Form>
    );
  }

  // CREATE mode — full shape.
  const createProps = props as CreateProps;
  const siteOptions = createProps.sites.map((s) => ({
    value: s.id,
    label: `${s.code} — ${s.name}`,
  }));
  const partyOptions = createProps.parties.map((p) => ({
    value: p.id,
    label: p.name,
    sub: p.short_code ?? p.type,
  }));
  const employmentOptions = EMPLOYMENT_TYPES.map((t) => ({
    value: t,
    label: EMPLOYMENT_LABELS[t],
  }));

  // eslint-disable-next-line react-hooks/incompatible-library
  const employmentType = form.watch('employment_type') as (typeof EMPLOYMENT_TYPES)[number];
  const needsContractor = employmentType !== 'DIRECT';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Ramesh Kumar"
                  maxLength={120}
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
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input
                  placeholder="10-digit mobile (optional)"
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
          name="home_city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Home city</FormLabel>
              <FormControl>
                <Input
                  placeholder="Optional"
                  maxLength={80}
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
          name="current_site_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current site *</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={siteOptions}
                  value={(field.value as string) || null}
                  onChange={field.onChange}
                  placeholder="Select site"
                />
              </FormControl>
              <FormDescription>Worker is placed at this site on day one.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="employment_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employment type *</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={employmentOptions}
                  value={(field.value as string) || null}
                  onChange={(v) => {
                    field.onChange(v);
                    if (v === 'DIRECT') {
                      form.setValue('contractor_party_id', null);
                    }
                  }}
                  placeholder="Select type"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {needsContractor && (
          <FormField
            control={form.control}
            name="contractor_party_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contractor *</FormLabel>
                <FormControl>
                  <SearchableSelect
                    options={partyOptions}
                    value={(field.value as string) || null}
                    onChange={field.onChange}
                    placeholder="Select contractor"
                  />
                </FormControl>
                <FormDescription>
                  The party that employs this worker (or lends them to this site).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Saving…' : 'Create worker'}
        </Button>
      </form>
    </Form>
  );
}
