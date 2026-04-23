'use server';
import { runAction } from '@/lib/actions/shared';
import {
  locationTemplateCreateSchema,
  locationTemplateNodeCreateSchema,
  locationUnitCreateSchema,
} from '@/lib/validators/location';
import { revalidatePath } from 'next/cache';

export async function createTemplate(raw: unknown) {
  const res = await runAction(locationTemplateCreateSchema, raw, async (input, sb) => {
    const { data, error } = await sb
      .from('location_templates')
      .insert({ name: input.name, description: input.description ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/locations');
  return res;
}

export async function createTemplateNode(raw: unknown) {
  const res = await runAction(locationTemplateNodeCreateSchema, raw, async (input, sb) => {
    const { data, error } = await sb
      .from('location_template_nodes')
      .insert({
        template_id: input.template_id,
        parent_id: input.parent_id ?? null,
        name: input.name,
        code: input.code,
        type: input.type,
        position: input.position ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/locations');
  return res;
}

export async function createUnit(raw: unknown) {
  const res = await runAction(locationUnitCreateSchema, raw, async (input, sb) => {
    const { data, error } = await sb
      .from('location_units')
      .insert({
        site_id: input.site_id,
        name: input.name,
        code: input.code,
        type: input.type,
        template_id: input.template_id ?? null,
        position: input.position ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  });
  if (res.ok) revalidatePath('/masters/locations');
  return res;
}
