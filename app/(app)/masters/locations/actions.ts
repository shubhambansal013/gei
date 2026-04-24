'use server';
import { runAction } from '@/lib/actions/shared';
import {
  locationUnitCreateSchema,
  locationUnitUpdateSchema,
} from '@/lib/validators/location';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export async function createUnit(raw: unknown) {
  const res = await runAction(locationUnitCreateSchema, raw, async (input, sb) => {
    const { data, error } = await sb
      .from('location_units')
      .insert({
        site_id: input.site_id,
        name: input.name,
        code: input.code,
        type: input.type,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/locations');
  return res;
}

export async function updateUnit(raw: unknown) {
  const res = await runAction(locationUnitUpdateSchema, raw, async (input, sb) => {
    const { data, error } = await sb
      .from('location_units')
      .update({
        name: input.name,
        code: input.code,
        type: input.type,
      })
      .eq('id', input.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/locations');
  return res;
}

export async function deleteUnit(id: string) {
  const res = await runAction(z.string().uuid(), id, async (id, sb) => {
    const { error } = await sb.from('location_units').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
  if (res.ok) revalidatePath('/masters/locations');
  return res;
}
