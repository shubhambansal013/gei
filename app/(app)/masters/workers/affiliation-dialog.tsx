'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/searchable-select';
import { changeAffiliation } from './actions';
import { EMPLOYMENT_TYPES } from '@/lib/validators/worker';
import type { DlgProps, PartyOption } from './types';

const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  DIRECT: 'Direct',
  CONTRACTOR_EMPLOYEE: 'Contractor employee',
  SUBCONTRACTOR_LENT: 'Sub-contractor (lent)',
};

export function AffiliationDialog({
  worker,
  parties,
  onClose,
  onDone,
}: DlgProps<{ parties: PartyOption[] }>) {
  const today = new Date().toISOString().slice(0, 10);
  const [type, setType] = useState<(typeof EMPLOYMENT_TYPES)[number] | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [busy, setBusy] = useState(false);

  const open = worker !== null;
  const needsParty = type !== null && type !== 'DIRECT';

  async function submit() {
    if (!worker || !type) return;
    if (needsParty && !partyId) return;
    setBusy(true);
    try {
      const res = await (changeAffiliation as (raw: unknown) => Promise<{ ok: boolean; error?: string }>)(
        {
          worker_id: worker.id,
          employment_type: type,
          contractor_party_id: type === 'DIRECT' ? null : partyId,
          effective_from: effectiveFrom,
        },
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Affiliation updated.');
      onDone();
      setType(null);
      setPartyId(null);
      setEffectiveFrom(today);
    } finally {
      setBusy(false);
    }
  }

  const typeOptions = EMPLOYMENT_TYPES.map((t) => ({
    value: t,
    label: EMPLOYMENT_LABELS[t],
  }));
  const partyOptions = parties.map((p) => ({
    value: p.id,
    label: p.name,
    sub: p.short_code ?? p.type,
  }));

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change affiliation</DialogTitle>
        </DialogHeader>
        {worker && (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-sm">
              Updating employment for <span className="font-medium">{worker.full_name}</span> (
              {worker.code}). Current: {worker.employment_type ?? '—'}.
            </p>
            <div className="grid gap-1.5">
              <Label>New type *</Label>
              <SearchableSelect
                options={typeOptions}
                value={type}
                onChange={(v) => {
                  setType(v as (typeof EMPLOYMENT_TYPES)[number]);
                  if (v === 'DIRECT') setPartyId(null);
                }}
                placeholder="Select type"
              />
            </div>
            {needsParty && (
              <div className="grid gap-1.5">
                <Label>Contractor *</Label>
                <SearchableSelect
                  options={partyOptions}
                  value={partyId}
                  onChange={setPartyId}
                  placeholder="Select contractor"
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="a-eff-from">Effective from *</Label>
              <Input
                id="a-eff-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!type || (needsParty && !partyId) || busy}>
            {busy ? 'Saving…' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
