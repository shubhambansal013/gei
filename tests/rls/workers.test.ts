import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { asUser, service, setGlobalRole } from './helpers';

/**
 * RLS tests for the Workforce aggregate.
 */

const SUPABASE_UP = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

const d = SUPABASE_UP ? describe : describe.skip;

d('workers RLS', () => {
  const uniq = `W${Math.floor(Math.random() * 1000000)}`;
  let siteAId: string;
  let siteBId: string;

  beforeAll(async () => {
    const svc = service();
    const { data: a } = await svc
      .from('sites')
      .insert({ code: `WRK-A-${uniq}`, name: `Workers RLS A ${uniq}` })
      .select()
      .single();
    const { data: b } = await svc
      .from('sites')
      .insert({ code: `WRK-B-${uniq}`, name: `Workers RLS B ${uniq}` })
      .select()
      .single();
    siteAId = a!.id;
    siteBId = b!.id;
  });

  afterAll(async () => {
    const svc = service();
    await svc.from('workers').delete().in('current_site_id', [siteAId, siteBId]);
    await svc.from('sites').delete().in('id', [siteAId, siteBId]);
  });

  it('SUPER_ADMIN can INSERT a worker and the trigger mints W-####', async () => {
    const admin = await asUser(`wrk-sa-${uniq}@test.local`);
    const { data: who } = await admin.auth.getUser();
    await setGlobalRole(who.user!.id, 'SUPER_ADMIN');

    const { data, error } = await admin
      .from('workers')
      .insert({ full_name: 'RLS Test Admin Worker', current_site_id: siteAId })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.code).toMatch(/^W-[0-9]{4,}$/);
  });

  it('VIEWER without WORKERS.CREATE cannot INSERT', async () => {
    const viewer = await asUser(`wrk-viewer-${uniq}@test.local`);
    const { data: who } = await viewer.auth.getUser();
    await setGlobalRole(who.user!.id, 'VIEWER');

    const { error } = await viewer
      .from('workers')
      .insert({ full_name: 'Blocked', current_site_id: siteAId });
    expect(error).not.toBeNull();
  });

  it('inactive user cannot SELECT workers', async () => {
    const u = await asUser(`wrk-inactive-${uniq}@test.local`);
    const { data: who } = await u.auth.getUser();
    await service().from('profiles').update({ is_active: false }).eq('id', who.user!.id);
    const { data, error } = await u.from('workers').select('id');
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it('code is immutable after mint', async () => {
    const svc = service();
    const { data: w } = await svc
      .from('workers')
      .insert({ full_name: 'Immutable Code', current_site_id: siteAId })
      .select()
      .single();

    const admin = await asUser(`wrk-sa-${uniq}@test.local`);
    const { error } = await admin.from('workers').update({ code: 'W-9999' }).eq('id', w!.id);
    expect(error).not.toBeNull();
  });

  it('EXCLUDE constraint blocks overlapping site assignments', async () => {
    const svc = service();
    const { data: w } = await svc
      .from('workers')
      .insert({ full_name: 'Overlap Test', current_site_id: siteAId })
      .select()
      .single();

    await svc.from('worker_site_assignments').insert({
      worker_id: w!.id,
      site_id: siteAId,
      effective_from: '2026-01-01',
    });

    const { error } = await svc.from('worker_site_assignments').insert({
      worker_id: w!.id,
      site_id: siteBId,
      effective_from: '2026-02-01', // still open — overlaps with above
    });
    expect(error).not.toBeNull();
  });

  it('transfer leaves exactly one open assignment', async () => {
    const svc = service();
    const { data: w } = await svc
      .from('workers')
      .insert({ full_name: 'Transfer Test', current_site_id: siteAId })
      .select()
      .single();

    // Seed: open assignment at site A
    await svc.from('worker_site_assignments').insert({
      worker_id: w!.id,
      site_id: siteAId,
      effective_from: '2026-01-01',
    });

    // Simulate transfer server-action logic via service role:
    // close A, open B.
    await svc
      .from('worker_site_assignments')
      .update({ effective_to: '2026-02-01' })
      .eq('worker_id', w!.id)
      .is('effective_to', null);
    await svc.from('worker_site_assignments').insert({
      worker_id: w!.id,
      site_id: siteBId,
      effective_from: '2026-02-01',
    });
    await svc.from('workers').update({ current_site_id: siteBId }).eq('id', w!.id);

    const { data: open } = await svc
      .from('worker_site_assignments')
      .select('id')
      .eq('worker_id', w!.id)
      .is('effective_to', null);
    expect(open?.length).toBe(1);
  });

  it('affiliation_party_rule rejects DIRECT with contractor_party_id', async () => {
    const svc = service();
    const { data: w } = await svc
      .from('workers')
      .insert({ full_name: 'Affiliation Test', current_site_id: siteAId })
      .select()
      .single();

    // Using SUPPLIER type which exists
    const { data: party, error: pError } = await svc
      .from('parties')
      .insert({ name: `WRK RLS Party ${uniq}`, type: 'SUPPLIER', short_code: `WRK${uniq.slice(0,5)}` })
      .select()
      .single();

    if (pError) throw pError;

    const { error } = await svc.from('worker_affiliations').insert({
      worker_id: w!.id,
      employment_type: 'DIRECT',
      contractor_party_id: party?.id,
      effective_from: '2026-01-01',
    });
    expect(error).not.toBeNull();

    if (party) await svc.from('parties').delete().eq('id', party.id);
  });
});
