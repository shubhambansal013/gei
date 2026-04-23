'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type Props = {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  title: string;
  description?: string;
  requireReason?: boolean;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
};

/**
 * Generic confirm dialog.
 *
 * When `requireReason=true`, the user must type a non-empty reason
 * before the Confirm button enables. Used for inline edits and
 * soft-delete actions so every audit-logged change has context.
 *
 * The reason is passed back to `onConfirm` so the caller can forward
 * it to a server action that does `SET LOCAL app.edit_reason = $reason`
 * before the UPDATE — see `inventory_edit_log` trigger.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  requireReason,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canConfirm = !requireReason || reason.trim().length > 0;

  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim() || undefined);
      onOpenChange(false);
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <p className="text-sm text-gray-600">{description}</p>}
        </DialogHeader>
        {requireReason && (
          <div className="grid gap-2">
            <Label htmlFor="confirm-reason">Reason</Label>
            <Input
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change being made?"
              autoFocus
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!canConfirm || busy}
            onClick={handle}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
