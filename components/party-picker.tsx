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
import { createParty } from '@/app/(app)/masters/parties/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type PartyOption = {
  id: string;
  name: string;
  type: string;
  short_code?: string | null;
};

type Props = {
  parties: PartyOption[];
  /**
   * Restricts the dropdown to parties of this type and pre-selects the
   * type for the quick-create dialog. When omitted, every party is
   * shown and the user picks a type in the dialog.
   */
  type?: string;
  value: string | null;
  onChange: (partyId: string | null) => void;
  placeholder?: string;
};

/**
 * Mirror of WorkerPicker but for the parties master. Supplies an
 * inline "+ New party" sentinel so a store worker can add a supplier
 * or contractor without leaving the entry form. The dialog captures
 * only name (+ type, if the parent didn't pin it, + optional short
 * code) — richer fields like GSTIN or address stay on the full
 * /masters/parties form.
 */
export function PartyPicker({
  parties,
  type,
  value,
  onChange,
  placeholder = 'Pick a party',
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(type ?? 'SUPPLIER');
  const [newShortCode, setNewShortCode] = useState('');
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => {
    const filtered = type ? parties.filter((p) => p.type === type) : parties;
    return filtered.map((p) => ({
      value: p.id,
      label: p.short_code ? `${p.short_code} — ${p.name}` : p.name,
      sub: p.short_code ? `${p.name} · ${p.type}` : p.type,
    }));
  }, [parties, type]);

  const NEW_SENTINEL = '__NEW__';
  const newLabel = type
    ? `+ New ${type.toLowerCase()} (quick create)`
    : '+ New party (quick create)';
  const withNew = [...options, { value: NEW_SENTINEL, label: newLabel, sub: 'opens dialog' }];

  function handleSelect(v: string | null) {
    if (v === NEW_SENTINEL) {
      setDialogOpen(true);
      return;
    }
    onChange(v);
  }

  async function createAndSelect() {
    const name = newName.trim();
    if (!name) return;
    const short = newShortCode.trim().toUpperCase();
    setBusy(true);
    try {
      const res = await createParty({
        name,
        type: newType,
        short_code: short || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${newType.toLowerCase()} "${res.data.name}" created.`);
      onChange(res.data.id);
      setDialogOpen(false);
      setNewName('');
      setNewShortCode('');
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
        placeholder={placeholder}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {type ? type.toLowerCase() : 'party'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-name">Name *</Label>
              <Input
                id="np-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                maxLength={120}
              />
            </div>
            {!type && (
              <div className="grid gap-1.5">
                <Label>Type *</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                    <SelectItem value="SUBCONTRACTOR">Sub-Contractor</SelectItem>
                    <SelectItem value="CLIENT">Client</SelectItem>
                    <SelectItem value="CONSULTANT">Consultant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="np-short">Short code</Label>
              <Input
                id="np-short"
                value={newShortCode}
                onChange={(e) => setNewShortCode(e.target.value.toUpperCase())}
                placeholder="e.g. KB for Krishna Builders"
                maxLength={8}
                className="font-mono uppercase"
              />
              <p className="text-muted-foreground text-xs">
                2-8 letters or digits. Optional — skip if you don&apos;t have one yet.
              </p>
            </div>
            <p className="text-muted-foreground text-xs">
              Richer fields (GSTIN, phone, address) live on the full form at /masters/parties.
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
