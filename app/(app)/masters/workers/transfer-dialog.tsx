'use client';
import { useMemo, useState } from 'react';
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
import { transferWorker } from './actions';
import type { DlgProps, SiteOption } from './types';

export function TransferDialog({
  worker,
  sites,
  onClose,
  onDone,
}: DlgProps<{ sites: SiteOption[] }>) {
  const today = new Date().toISOString().slice(0, 10);
  const [toSiteId, setToSiteId] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const open = worker !== null;
  const otherSites = useMemo(
    () => sites.filter((s) => s.id !== worker?.current_site_id),
    [sites, worker],
  );

  async function submit() {
    if (!worker || !toSiteId || !reason.trim()) return;
    setBusy(true);
    try {
      const res = await (transferWorker as (raw: unknown) => Promise<{ ok: boolean; error?: string }>)(
        {
          worker_id: worker.id,
          to_site_id: toSiteId,
          effective_from: effectiveFrom,
          reason: reason.trim(),
        },
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Worker transferred.');
      onDone();
      setToSiteId(null);
      setEffectiveFrom(today);
      setReason('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer worker</DialogTitle>
        </DialogHeader>
        {worker && (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-sm">
              Moving <span className="font-medium">{worker.full_name}</span> ({worker.code}) from{' '}
              <span className="font-medium">{worker.site_code ?? '—'}</span>.
            </p>
            <div className="grid gap-1.5">
              <Label>To site *</Label>
              <SearchableSelect
                options={otherSites.map((s) => ({
                  value: s.id,
                  label: `${s.code} — ${s.name}`,
                }))}
                value={toSiteId}
                onChange={setToSiteId}
                placeholder="Select site"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-eff-from">Effective from *</Label>
              <Input
                id="t-eff-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-reason">Reason *</Label>
              <Input
                id="t-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this worker being transferred?"
                maxLength={200}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!toSiteId || !reason.trim() || busy}>
            {busy ? 'Transferring…' : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
