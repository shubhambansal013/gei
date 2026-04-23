'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/searchable-select';
import { createWorker } from '@/app/(app)/masters/workers/actions';

export type WorkerOption = {
  id: string;
  code: string;
  full_name: string;
  current_site_id: string;
};

type Props = {
  workers: WorkerOption[];
  siteId: string;
  value: string | null;
  onChange: (workerId: string | null) => void;
};

/**
 * Picker for selecting the worker who physically received the material
 * on an outward row. Offers inline "+ New worker (DIRECT)" creation so
 * a store worker can add a missing name without leaving the form.
 *
 * Scope:
 *   Only workers placed at `siteId` show up. The quick-create dialog
 *   records the new worker at the same site as DIRECT — non-DIRECT
 *   creations still go through /masters/workers where contractor
 *   selection is required.
 */
export function WorkerPicker({ workers, siteId, value, onChange }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () =>
      workers
        .filter((w) => w.current_site_id === siteId)
        .map((w) => ({
          value: w.id,
          label: w.full_name,
          sub: w.code,
        })),
    [workers, siteId],
  );

  // Add the sentinel "create new" option at the bottom so a keyboard
  // user can arrow-down into it after scanning the list.
  const NEW_SENTINEL = '__NEW__';
  const withNew = [
    ...options,
    { value: NEW_SENTINEL, label: '+ New worker (quick create)', sub: 'opens dialog' },
  ];

  function handleSelect(v: string) {
    if (v === NEW_SENTINEL) {
      setDialogOpen(true);
      return;
    }
    onChange(v);
  }

  async function createAndSelect() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await createWorker({
        full_name: newName.trim(),
        current_site_id: siteId,
        employment_type: 'DIRECT',
        phone: newPhone.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Worker ${res.data.code} created.`);
      onChange(res.data.id);
      setDialogOpen(false);
      setNewName('');
      setNewPhone('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SearchableSelect
        options={withNew}
        value={value}
        onChange={handleSelect}
        placeholder="Pick a worker"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add worker</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nw-name">Full name *</Label>
              <Input
                id="nw-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nw-phone">Phone</Label>
              <Input
                id="nw-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                maxLength={20}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Added as DIRECT at the current site. For contractor or lent workers, use the full form
              at /masters/workers.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={createAndSelect} disabled={!newName.trim() || busy}>
              {busy ? 'Creating…' : 'Create & pick'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
