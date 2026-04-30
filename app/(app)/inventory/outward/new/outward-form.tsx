'use client';
import { useState, useTransition, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/searchable-select';
import { WorkerPicker, type WorkerOption } from '@/components/worker-picker';
import { PartyPicker, type PartyOption } from '@/components/party-picker';
import { createIssue } from './actions';

type Site = { id: string; name: string; code: string };
type Item = { id: string; name: string; code: string | null; stock_unit: string };
type LocationUnit = { id: string; name: string; code: string; site_id: string };

type Props = {
  sites: Site[];
  items: Item[];
  parties: PartyOption[];
  locations: LocationUnit[];
  workers: WorkerOption[];
};

/**
 * Issue (outward) entry form. Destination is decomposed into two
 * independent fields — Location and Party — because the business
 * reality is three-valued: material can go to a location, to a
 * contractor, or to a contractor AT a location (the most common
 * case on a large site).
 *
 * Issued-to: a WorkerPicker (with inline "+ New worker") is used
 * for selecting the recipient worker.
 */
export function IssueForm({ sites, items, parties, locations, workers }: Props) {
  const [pending, startTransition] = useTransition();

  const [siteId, setSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.id === itemId);

  const locationOptions = useMemo(
    () =>
      locations
        .filter((l) => l.site_id === siteId)
        .map((l) => ({ value: l.id, label: l.name, sub: l.code })),
    [locations, siteId],
  );

  const siteOptions = sites.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }));
  const itemOptions = items.map((i) => ({
    value: i.id,
    label: i.name,
    sub: i.code ? `${i.code} · ${i.stock_unit}` : i.stock_unit,
  }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !itemId || !qty) {
      toast.error('Site, item, and qty are required.');
      return;
    }
    if (!locationId && !partyId) {
      toast.error('Pick at least one of Location or Party.');
      return;
    }
    if (!workerId) {
      toast.error('Pick the worker who received the material.');
      return;
    }

    const base = {
      site_id: siteId,
      issue_date: issueDate,
      item_id: itemId,
      qty,
      unit: selectedItem?.stock_unit ?? '',
      worker_id: workerId,
    };

    const payload = locationId
      ? {
          ...base,
          destinationKind: 'location' as const,
          location_unit_id: locationId,
          party_id: partyId,
        }
      : { ...base, destinationKind: 'party' as const, party_id: partyId! };

    startTransition(async () => {
      try {
        const res = await createIssue(payload);
        if (res.ok) {
          toast.success('Issue recorded.');
          setQty('');
          setItemId(null);
          setLocationId(null);
          setPartyId(null);
          setWorkerId(null);
        } else {
          toast.error(res.error);
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to record issue.');
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
        <Label htmlFor="issueDate">Date *</Label>
        <Input
          id="issueDate"
          type="date"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
          required
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
        <Label>Location</Label>
        <SearchableSelect
          options={locationOptions}
          value={locationId}
          onChange={setLocationId}
          placeholder="Where on site? (optional)"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Party</Label>
        <PartyPicker
          parties={parties}
          value={partyId}
          onChange={setPartyId}
          placeholder="Contractor / customer (optional)"
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Fill at least one. Both is fine — e.g. &ldquo;KB&rsquo;s crew working on Block 3&rdquo; sets
        Location <span className="font-medium">and</span> Party.
      </p>

      <div className="space-y-1.5">
        <Label>Issued to *</Label>
        <WorkerPicker
          workers={workers}
          siteId={siteId ?? ''}
          value={workerId}
          onChange={setWorkerId}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Submit'}
      </Button>
    </form>
  );
}
