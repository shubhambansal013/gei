'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect } from '@/components/searchable-select';
import { PartyPicker } from '@/components/party-picker';
import { createPurchase } from './actions';

type Site = { id: string; name: string; code: string };
type Item = { id: string; name: string; code: string | null; stock_unit: string };
type Party = { id: string; name: string; type: string };
type Unit = { id: string; label: string; category: string | null };

type Props = {
  sites: Site[];
  items: Item[];
  suppliers: Party[];
  units: Unit[];
};

/**
 * Purchase (inward) entry form. All fields visible at once — optional
 * ones are labelled as such and grouped in a subdued block so the eye
 * reads past them. This is a deliberate shift from the earlier
 * "show detailed fields" toggle: real site-store workers fill the
 * whole form in one pass (with a supplier they may need to create
 * on the spot), and the toggle was hiding the rate field that is
 * required to compute a purchase value on the dashboard.
 */
export function PurchaseForm({ sites, items, suppliers, units }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [siteId, setSiteId] = useState<string | null>(sites[0]?.id ?? null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [receivedUnit, setReceivedUnit] = useState<string | null>(null);
  const [convFactor, setConvFactor] = useState('1');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [rate, setRate] = useState('');
  const [hsn, setHsn] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [partNo, setPartNo] = useState('');

  const selectedItem = items.find((i) => i.id === itemId);

  const handleItemChange = (id: string | null) => {
    setItemId(id);
    const item = items.find((i) => i.id === id);
    if (item) {
      setReceivedUnit(item.stock_unit);
      setConvFactor('1');
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteId || !itemId || !qty || !receivedUnit || !convFactor) {
      toast.error('Please fill all required fields.');
      return;
    }
    startTransition(async () => {
      const res = await createPurchase({
        site_id: siteId,
        item_id: itemId,
        received_qty: qty,
        received_unit: receivedUnit,
        stock_unit: selectedItem?.stock_unit ?? '',
        unit_conv_factor: convFactor,
        vendor_id: supplierId ?? null,
        invoice_no: invoiceNo || null,
        rate: rate || null,
        hsn_sac: hsn || null,
        invoice_date: invoiceDate || null,
        manufacturer: manufacturer || null,
        supplier_part_no: partNo || null,
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
  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.label,
    group: u.category,
  }));

  const q = parseFloat(qty);
  const f = parseFloat(convFactor);
  const stockQty = !isNaN(q) && !isNaN(f) ? (q * f).toFixed(4).replace(/\.?0+$/, '') : '0';

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
          onChange={handleItemChange}
          placeholder="Search items…"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="qty">Received Qty *</Label>
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
          <Label htmlFor="receivedUnit">Received Unit *</Label>
          <SearchableSelect
            options={unitOptions}
            value={receivedUnit}
            onChange={setReceivedUnit}
            placeholder="Unit"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="convFactor">Conv. Factor *</Label>
          <Input
            id="convFactor"
            type="number"
            inputMode="decimal"
            step="any"
            value={convFactor}
            onChange={(e) => setConvFactor(e.target.value)}
            className="font-mono tabular-nums"
            required
          />
          <p className="text-muted-foreground text-[10px]">
            {receivedUnit && selectedItem
              ? `1 ${receivedUnit} = ${convFactor} ${selectedItem.stock_unit}`
              : 'Stock units per received unit'}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Stock Qty</Label>
          <div className="bg-muted flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm font-mono tabular-nums">
            {stockQty} {selectedItem?.stock_unit}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Supplier (optional)</Label>
        <PartyPicker
          parties={suppliers}
          type="SUPPLIER"
          value={supplierId}
          onChange={setSupplierId}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invoice">Invoice # (optional)</Label>
        <Input
          id="invoice"
          value={invoiceNo}
          onChange={(e) => setInvoiceNo(e.target.value)}
          placeholder="e.g. INV-2026-0412"
        />
      </div>

      <Separator />

      <p className="text-muted-foreground text-xs">
        All fields below are optional. Fill what you have; the dashboard uses rate to value
        purchases.
      </p>

      <div className="bg-muted/30 space-y-3 rounded-md border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Record purchase'}
      </Button>
    </form>
  );
}
