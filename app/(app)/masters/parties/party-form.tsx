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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/searchable-select';
import { partyCreateSchema, partyUpdateSchema } from '@/lib/validators/party';
import type { PartyCreate, PartyUpdate } from '@/lib/validators/party';
import { createParty, updateParty } from './actions';

type PartyType = { id: string; label: string };

type CreateMode = {
  mode: 'create';
  partyTypes: PartyType[];
  onSuccess?: () => void;
};

type EditMode = {
  mode: 'edit';
  partyTypes: PartyType[];
  defaultValues: {
    id: string;
    name: string;
    type: string;
    short_code?: string | null;
    gstin?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  onSuccess?: () => void;
};

type Props = CreateMode | EditMode;

export function PartyForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  const schema = isEdit ? partyUpdateSchema : partyCreateSchema;

  const form = useForm<PartyCreate | PartyUpdate>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: isEdit
      ? {
          id: props.defaultValues.id,
          name: props.defaultValues.name,
          type: props.defaultValues.type,
          short_code: props.defaultValues.short_code ?? '',
          gstin: props.defaultValues.gstin ?? '',
          phone: props.defaultValues.phone ?? '',
          address: props.defaultValues.address ?? '',
          reason: '',
        }
      : {
          name: '',
          type: '',
          short_code: '',
          gstin: '',
          phone: '',
          address: '',
        },
  });

  const { isSubmitting } = form.formState;

  const typeOptions = props.partyTypes.map((pt) => ({ value: pt.id, label: pt.label }));

  async function onSubmit(values: PartyCreate | PartyUpdate) {
    try {
      // Normalise the empty string UX-convenience to null so the
      // validator (and DB CHECK) don't see '' and reject it.
      const normalised = {
        ...values,
        short_code:
          typeof values.short_code === 'string' && values.short_code.trim().length === 0
            ? null
            : values.short_code,
      } as PartyCreate | PartyUpdate;
      const res = isEdit ? await updateParty(normalised) : await createParty(normalised);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? 'Party updated.' : 'Party created.');
      router.refresh();
      props.onSuccess?.();
    } catch (e) {
      toast.error(isEdit ? 'Failed to update party.' : 'Failed to create party.');
      console.error(e);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="Party name" maxLength={120} {...field} disabled={isSubmitting} />
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
              <FormLabel>Type *</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={typeOptions}
                  value={(field.value as string) || null}
                  onChange={field.onChange}
                  placeholder="Select type"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="short_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short code</FormLabel>
              <FormControl>
                <Input
                  placeholder="2–8 letters/digits (e.g. ABC12)"
                  maxLength={8}
                  className="font-mono uppercase"
                  {...field}
                  value={(field.value as string) ?? ''}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gstin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GSTIN</FormLabel>
              <FormControl>
                <Input
                  placeholder="15-character GSTIN or blank"
                  maxLength={15}
                  className="font-mono uppercase"
                  {...field}
                  value={field.value ?? ''}
                  disabled={isSubmitting}
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
                  placeholder="Contact number"
                  maxLength={20}
                  {...field}
                  value={field.value ?? ''}
                  disabled={isSubmitting}
                />
              </FormControl>
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
                  placeholder="Registered address"
                  maxLength={500}
                  {...field}
                  value={field.value ?? ''}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isEdit && (
          <FormField
            control={form.control}
            name={'reason' as keyof (PartyCreate | PartyUpdate)}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason for edit *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Why is this change being made?"
                    {...field}
                    value={(field.value as string) ?? ''}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create party'}
        </Button>
      </form>
    </Form>
  );
}
