'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/searchable-select';
import { EmptyState } from '@/components/empty-state';
import { createTemplate, createTemplateNode, createUnit } from './actions';

type Template = { id: string; name: string; description: string | null };
type Node = {
  id: string;
  template_id: string;
  parent_id: string | null;
  name: string;
  code: string;
  type: string;
  position: number | null;
};
type Unit = {
  id: string;
  site_id: string;
  name: string;
  code: string;
  type: string;
  template_id: string | null;
  site: { id: string; code: string; name: string } | null;
  template: { id: string; name: string } | null;
};
type Site = { id: string; code: string; name: string };
type TypeRow = { id: string; label: string };

type Props = {
  templates: Template[];
  nodes: Node[];
  units: Unit[];
  sites: Site[];
  types: TypeRow[];
};

export function LocationsClient({ templates, nodes, units, sites, types }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState('templates');

  // Template form
  const [tName, setTName] = useState('');
  const [tDesc, setTDesc] = useState('');

  // Node form
  const [nodeTemplate, setNodeTemplate] = useState<string | null>(null);
  const [nodeParent, setNodeParent] = useState<string | null>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeCode, setNodeCode] = useState('');
  const [nodeType, setNodeType] = useState<string | null>(null);

  // Unit form
  const [uSite, setUSite] = useState<string | null>(null);
  const [uName, setUName] = useState('');
  const [uCode, setUCode] = useState('');
  const [uType, setUType] = useState<string | null>(null);
  const [uTemplate, setUTemplate] = useState<string | null>(null);

  const typeOptions = types.map((t) => ({ value: t.id, label: t.label }));
  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }));
  const siteOptions = sites.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }));
  const parentOptions = nodes
    .filter((n) => n.template_id === nodeTemplate)
    .map((n) => ({ value: n.id, label: `${n.name} (${n.code})`, sub: n.type }));

  const submitTemplate = () => {
    if (!tName) return toast.error('Name is required.');
    startTransition(async () => {
      const res = await createTemplate({ name: tName, description: tDesc || null });
      if (res.ok) {
        toast.success('Template created.');
        setTName('');
        setTDesc('');
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const submitNode = () => {
    if (!nodeTemplate || !nodeName || !nodeCode || !nodeType) {
      return toast.error('Template, name, code, type are required.');
    }
    startTransition(async () => {
      const res = await createTemplateNode({
        template_id: nodeTemplate,
        parent_id: nodeParent ?? null,
        name: nodeName,
        code: nodeCode,
        type: nodeType,
      });
      if (res.ok) {
        toast.success('Node added.');
        setNodeName('');
        setNodeCode('');
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const submitUnit = () => {
    if (!uSite || !uName || !uCode || !uType) {
      return toast.error('Site, name, code, and type are required.');
    }
    startTransition(async () => {
      const res = await createUnit({
        site_id: uSite,
        name: uName,
        code: uCode,
        type: uType,
        template_id: uTemplate ?? null,
      });
      if (res.ok) {
        toast.success('Unit created.');
        setUName('');
        setUCode('');
        router.refresh();
      } else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Locations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Templates define a reusable structure (e.g. Villa → Floor → Room). Units are the per-site
          instances of a template (e.g. Villa 6 on site RGIPT-SIV).
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <section className="bg-card space-y-3 rounded-md border p-4 shadow-sm">
              <h2 className="text-sm font-semibold">+ New template</h2>
              <div className="space-y-1.5">
                <Label htmlFor="tName">Name *</Label>
                <Input
                  id="tName"
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  placeholder="e.g. Hostel Block"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tDesc">Description</Label>
                <Input
                  id="tDesc"
                  value={tDesc}
                  onChange={(e) => setTDesc(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <Button onClick={submitTemplate} disabled={pending} size="sm">
                Create template
              </Button>
            </section>

            <section className="bg-card space-y-3 rounded-md border p-4 shadow-sm">
              <h2 className="text-sm font-semibold">+ Add node to template</h2>
              <div className="space-y-1.5">
                <Label>Template *</Label>
                <SearchableSelect
                  options={templateOptions}
                  value={nodeTemplate}
                  onChange={(v) => {
                    setNodeTemplate(v);
                    setNodeParent(null);
                  }}
                  placeholder="Pick template"
                />
              </div>
              {nodeTemplate && parentOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Parent node (optional)</Label>
                  <SearchableSelect
                    options={parentOptions}
                    value={nodeParent}
                    onChange={setNodeParent}
                    placeholder="Top-level if blank"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nName">Name *</Label>
                  <Input
                    id="nName"
                    value={nodeName}
                    onChange={(e) => setNodeName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nCode">Code *</Label>
                  <Input
                    id="nCode"
                    value={nodeCode}
                    onChange={(e) => setNodeCode(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <SearchableSelect
                  options={typeOptions}
                  value={nodeType}
                  onChange={setNodeType}
                  placeholder="floor / room / wing …"
                />
              </div>
              <Button onClick={submitNode} disabled={pending} size="sm">
                Add node
              </Button>
            </section>
          </div>

          <section className="bg-card rounded-md border shadow-sm">
            <div className="border-b px-4 py-2 text-sm font-semibold">Existing templates</div>
            {templates.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No templates yet"
                  description="Create your first template, then add nodes like Floor → Room."
                />
              </div>
            ) : (
              <ul className="divide-y">
                {templates.map((t) => {
                  const tNodes = nodes.filter((n) => n.template_id === t.id);
                  return (
                    <li key={t.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {tNodes.length} node{tNodes.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      {t.description && (
                        <p className="text-muted-foreground mt-0.5 text-xs">{t.description}</p>
                      )}
                      {tNodes.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {tNodes.map((n) => (
                            <li
                              key={n.id}
                              className="bg-muted rounded-sm px-1.5 py-0.5 font-mono text-xs"
                            >
                              {n.code} · {n.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="units" className="mt-4 space-y-6">
          <section className="bg-card space-y-3 rounded-md border p-4 shadow-sm">
            <h2 className="text-sm font-semibold">+ New unit</h2>
            <div className="space-y-1.5">
              <Label>Site *</Label>
              <SearchableSelect
                options={siteOptions}
                value={uSite}
                onChange={setUSite}
                placeholder="Pick site"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="uName">Name *</Label>
                <Input id="uName" value={uName} onChange={(e) => setUName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uCode">Code *</Label>
                <Input
                  id="uCode"
                  value={uCode}
                  onChange={(e) => setUCode(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Type *</Label>
                <SearchableSelect
                  options={typeOptions}
                  value={uType}
                  onChange={setUType}
                  placeholder="villa / block / flat …"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Template (optional)</Label>
                <SearchableSelect
                  options={templateOptions}
                  value={uTemplate}
                  onChange={setUTemplate}
                  placeholder="Link a template"
                />
              </div>
            </div>
            <Button onClick={submitUnit} disabled={pending} size="sm">
              Create unit
            </Button>
          </section>

          <section className="bg-card rounded-md border shadow-sm">
            <div className="border-b px-4 py-2 text-sm font-semibold">Existing units</div>
            {units.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No units yet"
                  description="Create a site-scoped unit (e.g. Villa 6) and optionally link it to a template."
                />
              </div>
            ) : (
              <ul className="divide-y">
                {units.map((u) => (
                  <li key={u.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="font-mono text-sm">{u.code}</span>{' '}
                        <span className="font-medium">{u.name}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {u.site?.code ?? '—'} · {u.type}
                        {u.template ? ` · ${u.template.name}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
