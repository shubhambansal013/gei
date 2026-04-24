'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/searchable-select';
import { editPurchase, editIssue } from './actions';

export type EditTarget = {
  id: string;
  type: 'PURCHASE' | 'ISSUE';
  currentQty: number;
  currentRef: string;
  receivedUnit?: string | null;
  convFactor?: number | null;
};

type Unit = { id: string; label: string; category: string | null };

type Props = {
  target: EditTarget | null;
  units: Unit[];
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
};

/**
 * Form dialog for editing a purchase or issue. Only the handful of
 * safe-to-edit columns are exposed — quantity and the ref field
 * (invoice # for purchase, issued-to for issue). Reason is required
 * because `editPurchase`/`editIssue` set `SET LOCAL app.edit_reason`
 * and the audit trigger writes before/after JSONB into
 * `inventory_edit_log`.
 */
export function EditDialog({ target, units, onOpenChange, onSuccess }: Props) {
  // Derive initial form state from the target. The dialog instance is
  // keyed on target.id by the parent (React re-mounts between targets),
  // so these useState hooks read the target at mount time — no effect
  // needed and no cascading re-renders.
  const [qty, setQty] = useState(target ? String(target.currentQty) : '');
  const [receivedUnit, setReceivedUnit] = useState(target?.receivedUnit ?? '');
  const [convFactor, setConvFactor] = useState(target ? String(target.convFactor) : '1');
  const [ref, setRef] = useState(target?.currentRef ?? '');
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();

  const canSubmit = reason.trim().length > 0 && !pending;
  const isPurchase = target?.type === 'PURCHASE';

  const handle = () => {
    if (!target || !canSubmit) return;
    startTransition(async () => {
      // Only send fields that changed — undefined values get stripped by
      // the server action's omitUndefined helper so we avoid blowing over
      // columns the user didn't touch.
      const qtyChanged = qty !== String(target.currentQty);
      const unitChanged = isPurchase && receivedUnit !== target.receivedUnit;
      const factorChanged = isPurchase && convFactor !== String(target.convFactor);
      const refChanged = ref !== target.currentRef;
      const payload = isPurchase
        ? {
            id: target.id,
            reason: reason.trim(),
            ...(qtyChanged ? { received_qty: qty } : {}),
            ...(unitChanged ? { received_unit: receivedUnit } : {}),
            ...(factorChanged ? { unit_conv_factor: convFactor } : {}),
            ...(refChanged ? { invoice_no: ref || null } : {}),
          }
        : {
            id: target.id,
            reason: reason.trim(),
            ...(qtyChanged ? { qty } : {}),
            ...(refChanged ? { issued_to_legacy: ref || null } : {}),
          };
      const res = isPurchase ? await editPurchase(payload) : await editIssue(payload);
      if (res.ok) {
        toast.success('Saved. Audit log captured the reason.');
        onSuccess();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {isPurchase ? 'purchase' : 'issue'} transaction</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Only qty and {isPurchase ? 'invoice #' : 'issued-to'} can be edited inline. For
            destination changes, soft-delete and re-enter.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-qty">{isPurchase ? 'Received Qty' : 'Qty'}</Label>
              <Input
                id="edit-qty"
                type="number"
                inputMode="decimal"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            {isPurchase && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-unit">Received Unit</Label>
                <SearchableSelect
                  options={units.map((u) => ({
                    value: u.id,
                    label: u.label,
                    group: u.category,
                  }))}
                  value={receivedUnit}
                  onChange={setReceivedUnit}
                  placeholder="Select unit"
                />
              </div>
            )}
          </div>

          {isPurchase && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-factor">Conv. Factor</Label>
                <Input
                  id="edit-factor"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={convFactor}
                  onChange={(e) => setConvFactor(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stock Qty</Label>
                <div className="bg-muted flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm font-mono tabular-nums">
                  {!isNaN(parseFloat(qty)) && !isNaN(parseFloat(convFactor))
                    ? (parseFloat(qty) * parseFloat(convFactor)).toFixed(4).replace(/\.?0+$/, '')
                    : '0'}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-ref">{isPurchase ? 'Invoice #' : 'Issued to'}</Label>
            <Input id="edit-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change being made? (audit log requires a reason)"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handle} disabled={!canSubmit}>
            {pending ? 'Saving…' : 'Save with reason'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
