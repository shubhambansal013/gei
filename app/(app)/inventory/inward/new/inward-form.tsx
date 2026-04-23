'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/searchable-select';
import { createPurchase } from './actions';

type Site = { id: string; name: string; code: string };
type Item = { id: string; name: string; code: string | null; stock_unit: string };
type Party = { id: string; name: string; type: string };

type Props = {
  sites: Site[];
  items: Item[];
  suppliers: Party[];
};

/**
 * Simple-mode purchase (inward) entry form — 5 fields + a detailed-mode
 * toggle for rate, HSN, dates, manufacturer, part number. Uses native
 * HTML submit + useTransition to stream the server action and keep the
 * button in a "Saving…" state until the response lands.
 */
export function PurchaseForm({ sites, items, suppliers }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [detailed, setDetailed] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');

  // Detailed mode fields
  const [rate, setRate] = useState('');
  const [hsn, setHsn] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [partNo, setPartNo] = useState('');

  const selectedItem = items.find((i) => i.id === itemId);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !itemId || !qty) {
      toast.error('Please fill item, qty, and site.');
      return;
    }
    startTransition(async () => {
      const res = await createPurchase({
        site_id: siteId,
        item_id: itemId,
        received_qty: qty,
        received_unit: selectedItem?.stock_unit ?? '',
        stock_unit: selectedItem?.stock_unit ?? '',
        unit_conv_factor: 1,
        vendor_id: supplierId ?? null,
        invoice_no: invoiceNo || null,
        rate: detailed && rate ? rate : null,
        hsn_sac: detailed ? hsn || null : null,
        invoice_date: detailed ? invoiceDate || null : null,
        manufacturer: detailed ? manufacturer || null : null,
        supplier_part_no: detailed ? partNo || null : null,
      });
      if (res.ok) {
        toast.success('Purchase recorded.');
        router.push('/inventory/transactions');
      } else {
        toast.error(res.error);
      }
    });
  };

  const siteOptions = sites.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }));
  const itemOptions = items.map((i) => ({
    value: i.id,
    label: i.name,
    sub: i.code ? `${i.code} · ${i.stock_unit}` : i.stock_unit,
  }));
  const supplierOptions = suppliers.map((p) => ({ value: p.id, label: p.name }));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="site">Site *</Label>
        <SearchableSelect
          options={siteOptions}
          value={siteId}
          onChange={setSiteId}
          placeholder="Select site"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="item">Item *</Label>
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
        <Label htmlFor="supplier">Supplier</Label>
        <SearchableSelect
          options={supplierOptions}
          value={supplierId}
          onChange={setSupplierId}
          placeholder="Select supplier"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invoice">Invoice #</Label>
        <Input
          id="invoice"
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          placeholder="e.g. INV-2026-0412"
        />
      </div>

      <Separator />

      <button
        type="button"
        onClick={() => setDetailed((v) => !v)}
        className="text-primary text-xs font-medium hover:underline"
      >
        {detailed ? '− Hide detailed fields' : '+ Show detailed fields'}
      </button>

      {detailed && (
        <div className="bg-muted/30 space-y-3 rounded-md border p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rate">Rate (₹/unit)</Label>
              <Input
                id="rate"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hsn">HSN/SAC</Label>
              <Input id="hsn" value={hsn} onChange={(e) => setHsn(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invDate">Invoice date</Label>
            <Input
              id="invDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mfg">Manufacturer</Label>
              <Input
                id="mfg"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partNo">Supplier part #</Label>
              <Input id="partNo" value={partNo} onChange={(e) => setPartNo(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Record purchase'}
      </Button>
    </form>
  );
}
