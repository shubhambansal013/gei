'use client';
import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MasterShell } from '@/components/master-shell';
import { DataGrid } from '@/components/data-grid';
import { EmptyState } from '@/components/empty-state';
import { SearchableSelect } from '@/components/searchable-select';
import { WorkerForm } from './worker-form';
import { transferWorker, changeAffiliation } from './actions';
import { EMPLOYMENT_TYPES } from '@/lib/validators/worker';

type Worker = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  home_city: string | null;
  is_active: boolean;
  current_site_id: string;
  site_code: string | null;
  site_name: string | null;
  employment_type: string | null;
  contractor_name: string | null;
};

type SiteOption = { id: string; name: string; code: string };
type PartyOption = { id: string; name: string; short_code: string | null; type: string };

type Props = {
  workers: Worker[];
  sites: SiteOption[];
  parties: PartyOption[];
};

const col = createColumnHelper<Worker>();

const STATIC_COLS = [
  col.accessor('code', {
    header: 'Code',
    cell: (info) => <span className="font-mono tracking-wide">{info.getValue()}</span>,
  }),
  col.accessor('full_name', { header: 'Name' }),
  col.accessor('site_code', {
    header: 'Site',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('employment_type', {
    header: 'Type',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('contractor_name', {
    header: 'Contractor',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('phone', {
    header: 'Phone',
    cell: (info) => info.getValue() ?? '—',
  }),
  col.accessor('is_active', {
    header: 'Active',
    cell: (info) => (info.getValue() ? 'Yes' : 'No'),
  }),
];

const EXPORT_COLS = [
  { key: 'code' as const, header: 'Code' },
  { key: 'full_name' as const, header: 'Name' },
  { key: 'site_code' as const, header: 'Site' },
  { key: 'employment_type' as const, header: 'Employment type' },
  { key: 'contractor_name' as const, header: 'Contractor' },
  { key: 'phone' as const, header: 'Phone' },
  { key: 'home_city' as const, header: 'Home city' },
];

const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  DIRECT: 'Direct',
  CONTRACTOR_EMPLOYEE: 'Contractor employee',
  SUBCONTRACTOR_LENT: 'Sub-contractor (lent)',
};

export function WorkersClient({ workers, sites, parties }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [transferFor, setTransferFor] = useState<Worker | null>(null);
  const [affiliateFor, setAffiliateFor] = useState<Worker | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.full_name.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        (w.phone ?? '').toLowerCase().includes(q) ||
        (w.site_code ?? '').toLowerCase().includes(q) ||
        (w.contractor_name ?? '').toLowerCase().includes(q),
    );
  }, [workers, search]);

  const openEdit = useCallback((w: Worker) => {
    setEditing(w);
    setSheetOpen(true);
  }, []);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  const columns = useMemo(
    (): ColumnDef<Worker, unknown>[] => [
      ...(STATIC_COLS as ColumnDef<Worker, unknown>[]),
      {
        id: 'actions',
        header: '',
        cell: (info) => {
          const w = info.row.original;
          return (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTransferFor(w)}>
                Transfer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAffiliateFor(w)}>
                Change affiliation
              </Button>
            </div>
          );
        },
      },
    ],
    [openEdit],
  );

  const defaultSiteId = sites[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Workers</h1>
      </header>

      <MasterShell
        title="workers"
        search={search}
        onSearch={setSearch}
        onNew={openCreate}
        canCreate
        exportFile="workers"
        exportCols={EXPORT_COLS}
        exportRows={filtered}
      >
        {filtered.length === 0 && !search.trim() ? (
          <EmptyState
            title="No workers yet"
            description="Add site workers to route issues and track placements."
            action={<Button onClick={openCreate}>+ New worker</Button>}
          />
        ) : (
          <DataGrid
            columns={columns}
            data={filtered}
            showRowNumbers
            emptyMessage="No workers match your search."
          />
        )}
      </MasterShell>

      <Sheet open={sheetOpen} onOpenChange={closeSheet}>
        <SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit worker' : 'New worker'}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {editing ? (
              <WorkerForm
                key={editing.id}
                mode="edit"
                defaultValues={{
                  id: editing.id,
                  full_name: editing.full_name,
                  phone: editing.phone,
                  home_city: editing.home_city,
                  is_active: editing.is_active,
                }}
                onSuccess={closeSheet}
              />
            ) : (
              <WorkerForm
                key="create"
                mode="create"
                sites={sites}
                parties={parties}
                defaultSiteId={defaultSiteId}
                onSuccess={closeSheet}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TransferDialog
        worker={transferFor}
        sites={sites}
        onClose={() => setTransferFor(null)}
        onDone={() => {
          setTransferFor(null);
          router.refresh();
        }}
      />
      <AffiliationDialog
        worker={affiliateFor}
        parties={parties}
        onClose={() => setAffiliateFor(null)}
        onDone={() => {
          setAffiliateFor(null);
          router.refresh();
        }}
      />
    </div>
  );
}

type DlgProps<T> = {
  worker: Worker | null;
  onClose: () => void;
  onDone: () => void;
} & T;

function TransferDialog({ worker, sites, onClose, onDone }: DlgProps<{ sites: SiteOption[] }>) {
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
      const res = await transferWorker({
        worker_id: worker.id,
        to_site_id: toSiteId,
        effective_from: effectiveFrom,
        reason: reason.trim(),
      });
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
                disabled={busy}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-eff-from">Effective from *</Label>
              <Input
                id="t-eff-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                disabled={busy}
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
                disabled={busy}
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

function AffiliationDialog({
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
      const res = await changeAffiliation({
        worker_id: worker.id,
        employment_type: type,
        contractor_party_id: type === 'DIRECT' ? null : partyId,
        effective_from: effectiveFrom,
      });
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
                  setType(v);
                  if (v === 'DIRECT') setPartyId(null);
                }}
                placeholder="Select type"
                disabled={busy}
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
                  disabled={busy}
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
                disabled={busy}
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
