'use client';
import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/searchable-select';
import type { SearchableOption } from '@/components/searchable-select';
import { WorkerPicker, type WorkerOption } from '@/components/worker-picker';
import { createIssue } from './actions';

type Site = { id: string; name: string; code: string };
type Item = { id: string; name: string; code: string | null; stock_unit: string };
type Party = { id: string; name: string; type: string };
type LocationRef = { id: string; full_path: string; full_code: string; site_id: string };

/**
 * A destination option encodes its kind in the `value` so the
 * server action can route to the right branch of the
 * `chk_issue_destination` check.
 *   value format: `<kind>:<id>`   e.g. `location:abc-123`
 */
type DestKind = 'location' | 'party' | 'site';
type DestValue = `${DestKind}:${string}`;

type Props = {
  sites: Site[];
  items: Item[];
  parties: Party[];
  locations: LocationRef[];
  workers: WorkerOption[];
};

/**
 * Four-field issue (outward) form. The destination dropdown is a single
 * SearchableSelect grouped by type (Locations · Parties · Sites) so
 * a worker only learns one interaction. Current-site filtering cuts
 * noise: locations are scoped to the current site; external sites
 * exclude the current one.
 *
 * Issued-to: a WorkerPicker (with inline "+ New worker") replaces the
 * free-text field. If the current site has zero workers we fall back
 * to the plain Input so a store worker can still complete the form;
 * the server action writes that value to `issued_to_legacy`.
 */
export function IssueForm({ sites, items, parties, locations, workers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [siteId, setSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [destination, setDestination] = useState<DestValue | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [issuedTo, setIssuedTo] = useState('');

  const siteWorkers = useMemo(
    () => workers.filter((w) => w.current_site_id === siteId),
    [workers, siteId],
  );
  const useLegacyInput = siteWorkers.length === 0;

  const selectedItem = items.find((i) => i.id === itemId);

  const destOptions = useMemo<SearchableOption<DestValue>[]>(() => {
    const siteLocations = locations.filter((l) => l.site_id === siteId);
    const externalSites = sites.filter((s) => s.id !== siteId);
    return [
      ...siteLocations.map(
        (l): SearchableOption<DestValue> => ({
          value: `location:${l.id}`,
          label: l.full_path,
          sub: l.full_code,
          group: 'Locations',
        }),
      ),
      ...parties.map(
        (p): SearchableOption<DestValue> => ({
          value: `party:${p.id}`,
          label: p.name,
          sub: p.type,
          group: 'Parties',
        }),
      ),
      ...externalSites.map(
        (s): SearchableOption<DestValue> => ({
          value: `site:${s.id}`,
          label: s.name,
          sub: s.code,
          group: 'Sites (transfer)',
        }),
      ),
    ];
  }, [siteId, locations, parties, sites]);

  const siteOptions = sites.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }));
  const itemOptions = items.map((i) => ({
    value: i.id,
    label: i.name,
    sub: i.code ? `${i.code} · ${i.stock_unit}` : i.stock_unit,
  }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !itemId || !qty || !destination) {
      toast.error('Item, qty, and destination are required.');
      return;
    }
    if (useLegacyInput) {
      if (!issuedTo.trim()) {
        toast.error('Issued-to name is required.');
        return;
      }
    } else if (!workerId) {
      toast.error('Pick the worker who received the material.');
      return;
    }
    const [kind, id] = destination.split(':', 2) as [DestKind, string];
    const base = {
      site_id: siteId,
      item_id: itemId,
      qty,
      unit: selectedItem?.stock_unit ?? '',
      worker_id: workerId,
      issued_to_legacy: useLegacyInput ? issuedTo.trim() || null : null,
    };
    const payload =
      kind === 'location'
        ? { ...base, destinationKind: 'location' as const, location_ref_id: id }
        : kind === 'party'
          ? { ...base, destinationKind: 'party' as const, party_id: id }
          : { ...base, destinationKind: 'site' as const, dest_site_id: id };

    startTransition(async () => {
      const res = await createIssue(payload);
      if (res.ok) {
        toast.success('Issue recorded.');
        router.push('/inventory/transactions');
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Site *</Label>
        <SearchableSelect
          options={siteOptions}
          value={siteId}
          onChange={setSiteId}
          placeholder="Select site"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Item *</Label>
        <SearchableSelect
          options={itemOptions}
          value={itemId}
          onChange={setItemId}
          placeholder="Search items…"
        />
      </div>

      <div className="grid grid-cols-[1fr_100px] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qty">Qty *</Label>
          <Input
            id="qty"
            type="number"
            inputMode="decimal"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="font-mono tabular-nums"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Unit</Label>
          <Input
            value={selectedItem?.stock_unit ?? ''}
            readOnly
            className="bg-muted font-mono text-sm"
            tabIndex={-1}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Destination *</Label>
        <SearchableSelect
          options={destOptions}
          value={destination}
          onChange={setDestination}
          placeholder="Where is it going?"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Issued to {useLegacyInput ? '' : '*'}</Label>
        {useLegacyInput ? (
          <Input
            id="issuedTo"
            value={issuedTo}
            onChange={(e) => setIssuedTo(e.target.value)}
            placeholder="Name of person who received (no workers registered)"
          />
        ) : (
          <WorkerPicker
            workers={workers}
            siteId={siteId ?? ''}
            value={workerId}
            onChange={setWorkerId}
          />
        )}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Record issue'}
      </Button>
    </form>
  );
}
