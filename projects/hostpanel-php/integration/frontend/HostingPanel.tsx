import React, { useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/Layout';
import { CyberCard, CyberButton, CyberBadge, CyberInput, cn } from '@/components/CyberUI';
import {
  Server, Globe, Shield, Plus, RefreshCw, ExternalLink, Lock, Trash2,
  CheckCircle2, AlertTriangle, Power, Wrench, Copy, ArrowLeft, Zap, Crown, BarChart2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// ─── API helper (raw-fetch pattern, same as Scanner/EmailVerifier) ──────────────
function getToken() {
  try { return JSON.parse(localStorage.getItem('priv8hash-storage') || '{}')?.state?.token; } catch { return null; }
}
async function api(path: string, opts: any = {}) {
  const r = await fetch('/api/hostpanel' + path, {
    headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  return { ...d, _status: r.status };
}

interface Plan {
  id: number; name: string; display_name: string; price_usd: string;
  self_service: boolean; max_sites: number; max_domains: number; features: Record<string, any>;
}
interface Account { user: string; domain: string; managed: boolean; ip: string; suspended: boolean; plan: string; }

const PLAN_ICON: Record<string, React.ReactNode> = {
  basic: <Server className="w-5 h-5" />, pro: <Zap className="w-5 h-5" />, managed: <Crown className="w-5 h-5" />,
};

export default function HostingPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Account | null>(null);
  const [view, setView] = useState<'mine' | 'admin'>('mine');

  const subQ = useQuery({ queryKey: ['hp-sub'], queryFn: () => api('/subscription') });
  const plansQ = useQuery({ queryKey: ['hp-plans'], queryFn: () => api('/plans') });

  // Read role from the persisted auth store (admin gets an Admin view).
  let role = 'user';
  try { role = JSON.parse(localStorage.getItem('priv8hash-storage') || '{}')?.state?.user?.role || 'user'; } catch {}
  const isAdmin = role === 'admin' || role === 'superadmin';

  const active = subQ.data?.active;
  const sub = subQ.data?.subscription;

  if (subQ.isLoading) {
    return <DashboardLayout><div className="p-8 text-t3 flex items-center gap-2">
      <RefreshCw className="w-4 h-4 animate-spin" /> Loading hosting…</div></DashboardLayout>;
  }

  // Admin viewing the admin console (independent of their own subscription).
  if (isAdmin && view === 'admin') {
    return <DashboardLayout><div className="p-4 md:p-6 max-w-6xl mx-auto">
      <AdminHeader view={view} setView={setView} />
      <AdminPane />
    </div></DashboardLayout>;
  }

  // Not subscribed → show plans (admins can still switch to the Admin view).
  if (!active) {
    return <DashboardLayout><div className="p-4 md:p-6 max-w-6xl mx-auto">
      {isAdmin && <AdminHeader view={view} setView={setView} />}
      <SubscribePane plans={plansQ.data?.plans || []} onDone={() => qc.invalidateQueries({ queryKey: ['hp-sub'] })} embedded={isAdmin} />
    </div></DashboardLayout>;
  }

  // Subscribed → sites list or a selected site.
  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        {isAdmin && <AdminHeader view={view} setView={setView} />}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-t1 flex items-center gap-2"><Server className="w-6 h-6 text-a1" /> Hosting Panel</h1>
            <p className="text-t3 text-sm mt-1">
              {sub?.display_name} · {sub?.self_service ? 'Self-service' : 'Managed'} ·
              {sub?.auto_renew === false ? ' ends ' : ' renews '}
              {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '—'}
              {sub?.auto_renew === false && <span className="text-warn"> (auto-renew off)</span>}
            </p>
          </div>
          <CyberBadge variant="success">{sub?.plan_name}</CyberBadge>
        </div>
        {selected
          ? <SiteView account={selected} selfService={!!sub?.self_service} onBack={() => setSelected(null)} />
          : <>
              <PlanBar sub={sub} plans={plansQ.data?.plans || []} onChange={() => qc.invalidateQueries({ queryKey: ['hp-sub'] })} />
              <SitesList onOpen={setSelected} selfService={!!sub?.self_service} maxSites={sub?.max_sites} />
            </>}
      </div>
    </DashboardLayout>
  );
}

// ─── Admin header (toggle My hosting / Admin) ───────────────────────────────────
function AdminHeader({ view, setView }: { view: 'mine' | 'admin'; setView: (v: 'mine' | 'admin') => void }) {
  return (
    <div className="flex gap-1 mb-5 bg-bg3 rounded-lg p-1 w-fit">
      {(['mine', 'admin'] as const).map((v) => (
        <button key={v} onClick={() => setView(v)}
          className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition',
            view === v ? 'bg-a1 text-black' : 'text-t3 hover:text-t1')}>
          {v === 'mine' ? 'My hosting' : 'Admin'}</button>
      ))}
    </div>
  );
}

// ─── Plan bar: upgrade / auto-renew toggle / invoices ───────────────────────────
function PlanBar({ sub, plans, onChange }: { sub: any; plans: Plan[]; onChange: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const autoRenew = sub?.auto_renew !== false;
  const upgrades = plans.filter((p) => Number(p.price_usd) > Number(sub?.price_usd ?? 0));

  const invoicesQ = useQuery({ queryKey: ['hp-invoices'], queryFn: () => api('/invoices'), enabled: showInvoices });

  const [upgradeCoupon, setUpgradeCoupon] = useState('');
  const changePlan = useMutation({
    mutationFn: (plan: string) => api('/change-plan', { method: 'POST', body: JSON.stringify({ plan, coupon: upgradeCoupon || undefined }) }),
    onSuccess: (d) => {
      if (d.ok) { toast({ title: 'Plan changed', description: d.charged > 0 ? `$${d.charged} charged (prorated).` : 'Applied.' }); onChange(); }
      else if (d.code === 'INSUFFICIENT_BALANCE') toast({ title: 'Insufficient balance', description: `Need $${d.needed}, you have $${d.current}.`, variant: 'destructive' as any });
      else toast({ title: 'Error', description: d.error, variant: 'destructive' as any });
    },
  });
  const setRenew = useMutation({
    mutationFn: (v: boolean) => api('/cancel', { method: 'POST', body: JSON.stringify(v ? { autoRenew: true } : { cancel: true }) }),
    onSuccess: (d) => { toast({ title: d.autoRenew ? 'Auto-renew on' : 'Auto-renew off', description: d.autoRenew ? 'Your hosting will renew automatically.' : 'Your hosting stays active until it expires, then stops.' }); onChange(); },
  });

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <CyberButton variant="ghost" size="sm" onClick={() => setOpen(!open)}><Zap className="w-4 h-4" /> Manage plan</CyberButton>
        <CyberButton variant="ghost" size="sm" onClick={() => { setShowInvoices(!showInvoices); setOpen(true); }}>Billing history</CyberButton>
      </div>
      {open && (
        <CyberCard className="p-4 mt-2 space-y-4">
          {/* upgrade options */}
          {upgrades.length > 0 && (
            <div>
              <div className="text-sm font-bold text-t1 mb-2">Upgrade plan</div>
              <div className="flex flex-wrap gap-2">
                {upgrades.map((p) => (
                  <CyberButton key={p.id} size="sm" variant="secondary" isLoading={changePlan.isPending && changePlan.variables === p.name}
                    onClick={() => changePlan.mutate(p.name)}>
                    {p.display_name} — ${Number(p.price_usd).toFixed(0)}/mo
                  </CyberButton>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 max-w-xs">
                <CyberInput placeholder="Coupon (optional)" value={upgradeCoupon} onChange={(e) => setUpgradeCoupon(e.target.value.toUpperCase())} className="flex-1" />
              </div>
              <p className="text-xs text-t3 mt-1">Upgrades charge only the prorated price difference for the rest of this cycle{upgradeCoupon ? ', with your coupon applied' : ''}.</p>
            </div>
          )}
          {/* auto-renew */}
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <div className="text-sm font-bold text-t1">Auto-renew</div>
              <div className="text-xs text-t3">{autoRenew ? 'Renews automatically from your wallet each month.' : 'Off — hosting stops at the end of this cycle.'}</div>
            </div>
            <CyberButton size="sm" variant={autoRenew ? 'danger' : 'primary'} isLoading={setRenew.isPending}
              onClick={() => setRenew.mutate(!autoRenew)}>{autoRenew ? 'Turn off' : 'Turn on'}</CyberButton>
          </div>
          {/* invoices */}
          {showInvoices && (
            <div className="border-t border-border pt-3">
              <div className="text-sm font-bold text-t1 mb-2">Billing history</div>
              {invoicesQ.isLoading && <div className="text-t3 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading…</div>}
              {invoicesQ.data?.invoices?.length === 0 && <div className="text-t3 text-sm">No payments yet.</div>}
              <div className="space-y-1">
                {(invoicesQ.data?.invoices || []).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between bg-bg3 rounded px-3 py-1.5 text-sm">
                    <span className="text-t2">{new Date(inv.created_at).toLocaleDateString()} · {inv.plan}</span>
                    <span className="font-mono text-t1">${Number(inv.final_amount).toFixed(2)} <CyberBadge variant="success">{inv.status}</CyberBadge></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CyberCard>
      )}
    </div>
  );
}

// ─── Admin report: stats dashboard ──────────────────────────────────────────────
function AdminReport() {
  const reportQ = useQuery({ queryKey: ['hp-admin-report'], queryFn: () => api('/admin/report') });
  const r = reportQ.data;
  if (reportQ.isLoading) return <CyberCard className="p-5 text-t3"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Loading report…</CyberCard>;
  if (!r?.revenue) return null;
  const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <div className="bg-bg3 rounded-lg p-3">
      <div className="text-xs text-t3">{label}</div>
      <div className={cn('text-xl font-bold', accent ? 'text-a1' : 'text-t1')}>{value}</div>
    </div>
  );
  const exportCsv = async (kind: string) => {
    const r = await fetch('/api/hostpanel/admin/export?kind=' + kind, { headers: { Authorization: 'Bearer ' + getToken() } });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `hostpanel-${kind}.csv`; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-t1 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-a1" /> Overview</h3>
        <div className="flex gap-2">
          <CyberButton size="sm" variant="ghost" onClick={() => exportCsv('orders')}>Export revenue CSV</CyberButton>
          <CyberButton size="sm" variant="ghost" onClick={() => exportCsv('subscriptions')}>Export subs CSV</CyberButton>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Active subscriptions" value={String(r.subscriptions.activeTotal)} accent />
        <Stat label="MRR (est.)" value={`$${r.revenue.mrr.toFixed(0)}`} accent />
        <Stat label="Revenue (all-time)" value={`$${r.revenue.total.toFixed(2)}`} />
        <Stat label="Revenue (30d)" value={`$${r.revenue.last30.toFixed(2)}`} />
        <Stat label="cPanel accounts" value={`${r.accounts.active ?? 0} active`} />
        <Stat label="Suspended" value={String(r.accounts.suspended ?? 0)} />
        <Stat label="Managed" value={String(r.accounts.managed ?? 0)} />
        <Stat label="Discounts given" value={`$${r.revenue.discountsGiven.toFixed(2)}`} />
      </div>
      {r.subscriptions.byPlan?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {r.subscriptions.byPlan.map((p: any) => (
            <CyberBadge key={p.plan} variant="default">{p.plan}: {p.active} active{p.grace ? `, ${p.grace} grace` : ''}{p.expired ? `, ${p.expired} expired` : ''}</CyberBadge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Admin coupons: create + list + toggle ──────────────────────────────────────
function AdminCoupons() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [pct, setPct] = useState('');
  const [amt, setAmt] = useState('');
  const [open, setOpen] = useState(false);
  const couponsQ = useQuery({ queryKey: ['hp-admin-coupons'], queryFn: () => api('/admin/coupons'), enabled: open });
  const create = useMutation({
    mutationFn: () => api('/admin/coupons', { method: 'POST', body: JSON.stringify({ code, discount_pct: Number(pct) || 0, discount_amount: Number(amt) || 0 }) }),
    onSuccess: (d) => {
      if (d.ok) { toast({ title: 'Coupon created', description: d.coupon.code }); setCode(''); setPct(''); setAmt(''); qc.invalidateQueries({ queryKey: ['hp-admin-coupons'] }); }
      else toast({ title: 'Error', description: d.error, variant: 'destructive' as any });
    },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: number; active: boolean }) => api('/admin/coupons/toggle', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hp-admin-coupons'] }),
  });

  return (
    <CyberCard className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-t1">Discount coupons</h3>
        <CyberButton variant="ghost" size="sm" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Manage'}</CyberButton>
      </div>
      {open && (
        <>
          <div className="grid md:grid-cols-4 gap-2 items-end">
            <div><label className="text-xs text-t3">Code</label><CyberInput placeholder="SAVE20" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></div>
            <div><label className="text-xs text-t3">% off</label><CyberInput placeholder="20" value={pct} onChange={(e) => setPct(e.target.value)} inputMode="numeric" /></div>
            <div><label className="text-xs text-t3">or $ off</label><CyberInput placeholder="5" value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="numeric" /></div>
            <CyberButton isLoading={create.isPending} onClick={() => create.mutate()}><Plus className="w-4 h-4" /> Create</CyberButton>
          </div>
          <div className="space-y-1">
            {(couponsQ.data?.coupons || []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-bg3 rounded px-3 py-1.5 text-sm">
                <span className="font-mono text-t1">{c.code} <span className="text-t3">— {c.discount_pct ? c.discount_pct + '%' : '$' + c.discount_amount} off · used {c.used_count}/{c.max_uses}</span></span>
                <div className="flex items-center gap-2">
                  {c.is_active ? <CyberBadge variant="success">active</CyberBadge> : <CyberBadge variant="danger">off</CyberBadge>}
                  <CyberButton size="sm" variant="ghost" onClick={() => toggle.mutate({ id: c.id, active: !c.is_active })}>{c.is_active ? 'Disable' : 'Enable'}</CyberButton>
                </div>
              </div>
            ))}
            {couponsQ.data?.coupons?.length === 0 && <div className="text-t3 text-sm">No coupons yet.</div>}
          </div>
        </>
      )}
    </CyberCard>
  );
}

// ─── Admin custom plans: create / edit / toggle ─────────────────────────────────
function AdminPlans() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: '', display_name: '', price_usd: '', max_sites: '1', max_domains: '1', self_service: true });
  const plansQ = useQuery({ queryKey: ['hp-admin-plans'], queryFn: () => api('/admin/plans'), enabled: open });

  const save = useMutation({
    mutationFn: () => api('/admin/plans', { method: 'POST', body: JSON.stringify({
      id: form.id, name: form.name, display_name: form.display_name,
      price_usd: Number(form.price_usd) || 0, max_sites: Number(form.max_sites) || 1,
      max_domains: Number(form.max_domains) || 1, self_service: form.self_service !== false,
    }) }),
    onSuccess: (d) => {
      if (d.ok) { toast({ title: d.edited ? 'Plan updated' : 'Plan created', description: d.plan.name }); setForm({ name: '', display_name: '', price_usd: '', max_sites: '1', max_domains: '1', self_service: true }); qc.invalidateQueries({ queryKey: ['hp-admin-plans'] }); qc.invalidateQueries({ queryKey: ['hp-plans'] }); }
      else toast({ title: 'Error', description: d.error, variant: 'destructive' as any });
    },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: number; active: boolean }) => api('/admin/plans/toggle', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: (d) => { if (!d.ok) toast({ title: 'Cannot hide', description: d.error, variant: 'destructive' as any }); qc.invalidateQueries({ queryKey: ['hp-admin-plans'] }); qc.invalidateQueries({ queryKey: ['hp-plans'] }); },
  });
  const edit = (p: any) => { setForm({ id: p.id, name: p.name, display_name: p.display_name, price_usd: String(p.price_usd), max_sites: String(p.max_sites), max_domains: String(p.max_domains), self_service: p.self_service }); };

  return (
    <CyberCard className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-t1">Plans</h3>
        <CyberButton variant="ghost" size="sm" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Manage'}</CyberButton>
      </div>
      {open && (
        <>
          <div className="grid md:grid-cols-6 gap-2 items-end">
            <div><label className="text-xs text-t3">Name{form.id && ' (fixed)'}</label><CyberInput placeholder="starter" value={form.name} disabled={!!form.id} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })} /></div>
            <div><label className="text-xs text-t3">Label</label><CyberInput placeholder="Starter" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
            <div><label className="text-xs text-t3">$/mo</label><CyberInput placeholder="5" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: e.target.value })} inputMode="numeric" /></div>
            <div><label className="text-xs text-t3">Sites</label><CyberInput placeholder="1" value={form.max_sites} onChange={(e) => setForm({ ...form, max_sites: e.target.value })} inputMode="numeric" /></div>
            <div><label className="text-xs text-t3">Domains</label><CyberInput placeholder="1" value={form.max_domains} onChange={(e) => setForm({ ...form, max_domains: e.target.value })} inputMode="numeric" /></div>
            <CyberButton isLoading={save.isPending} onClick={() => save.mutate()}>{form.id ? 'Save' : 'Create'}</CyberButton>
          </div>
          <div className="flex items-center gap-3 text-xs text-t3">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={form.self_service !== false} onChange={(e) => setForm({ ...form, self_service: e.target.checked })} /> Self-service
            </label>
            {form.id && <button className="text-t3 hover:text-a1 underline" onClick={() => setForm({ name: '', display_name: '', price_usd: '', max_sites: '1', max_domains: '1', self_service: true })}>Cancel edit</button>}
          </div>
          <div className="space-y-1">
            {(plansQ.data?.plans || []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between bg-bg3 rounded px-3 py-1.5 text-sm">
                <span className="text-t1"><b>{p.display_name}</b> <span className="text-t3 font-mono">({p.name}) — ${Number(p.price_usd).toFixed(0)}/mo · {p.max_sites} sites · {p.self_service ? 'self-service' : 'managed'}</span></span>
                <div className="flex items-center gap-2">
                  {p.is_active ? <CyberBadge variant="success">active</CyberBadge> : <CyberBadge variant="danger">hidden</CyberBadge>}
                  <CyberButton size="sm" variant="ghost" onClick={() => edit(p)}>Edit</CyberButton>
                  <CyberButton size="sm" variant="ghost" onClick={() => toggle.mutate({ id: p.id, active: !p.is_active })}>{p.is_active ? 'Hide' : 'Show'}</CyberButton>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </CyberCard>
  );
}

// ─── Admin console: provision cPanels for clients + oversee all accounts ────────
function AdminPane() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [forUser, setForUser] = useState('');
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);

  const accountsQ = useQuery({ queryKey: ['hp-admin-accounts'], queryFn: () => api('/admin/accounts') });
  const accounts = accountsQ.data?.accounts || [];

  const create = useMutation({
    mutationFn: () => api('/admin/create-cpanel', { method: 'POST', body: JSON.stringify({ forUser, domain, contactemail: email }) }),
    onSuccess: (d) => {
      if (d.ok) { setResult(d.cpanel); toast({ title: 'cPanel created', description: d.cpanel.domain }); qc.invalidateQueries({ queryKey: ['hp-admin-accounts'] }); }
      else toast({ title: 'Error', description: d.error || 'Failed', variant: 'destructive' as any });
    },
  });
  const action = useMutation({
    mutationFn: (v: { cpanelUser: string; action: string }) => api('/admin/action', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: (d, v) => {
      if (v.action === 'login' && d.url) window.open(d.url, '_blank');
      else if (v.action === 'reset' && d.password) toast({ title: 'New password', description: d.password });
      else toast({ title: 'Done', description: d.ok ? v.action : (d.error || 'error') });
      qc.invalidateQueries({ queryKey: ['hp-admin-accounts'] });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-t1 flex items-center gap-2 mb-1"><Crown className="w-6 h-6 text-warn" /> Admin — Hosting</h1>
        <p className="text-t3 text-sm">Provision and manage cPanel accounts for any client.</p>
      </div>

      <AdminReport />
      <AdminCoupons />
      <AdminPlans />

      <CyberCard className="p-5 space-y-3">
        <h3 className="font-bold text-t1">Create a cPanel for a client</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div><label className="text-xs text-t3">Client (email or user ID)</label>
            <CyberInput placeholder="leave blank = yourself" value={forUser} onChange={(e) => setForUser(e.target.value)} /></div>
          <div><label className="text-xs text-t3">Domain (optional)</label>
            <CyberInput placeholder="blank = free subdomain" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
          <div><label className="text-xs text-t3">Contact email (optional)</label>
            <CyberInput placeholder="client@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <CyberButton isLoading={create.isPending} onClick={() => create.mutate()}><Plus className="w-4 h-4" /> Create cPanel</CyberButton>
        {result && (
          <div className="bg-bg3 rounded-md p-3 text-sm space-y-1 mt-2">
            <div className="text-a1 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Created for user #{result.ownerId ?? '—'}</div>
            <Field label="Domain" value={result.domain} />
            <Field label="cPanel user" value={result.user} />
            <Field label="Password" value={result.password} copy />
          </div>
        )}
      </CyberCard>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-t1">All hosting accounts <span className="text-t3 text-sm">({accounts.length})</span></h3>
          <CyberButton variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['hp-admin-accounts'] })}><RefreshCw className="w-4 h-4" /></CyberButton>
        </div>
        <div className="space-y-2">
          {accounts.map((a: any) => (
            <CyberCard key={a.user} className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-a1 shrink-0" />
                  <span className="font-bold text-t1 truncate">{a.domain}</span>
                  {a.managed && <CyberBadge variant="warning">managed</CyberBadge>}
                  {a.suspended && <CyberBadge variant="danger">suspended</CyberBadge>}</div>
                <div className="text-xs text-t3 font-mono mt-1">{a.user} · owner: {a.ownerEmail || ('#' + a.ownerId)} · {a.plan || 'no plan'}</div>
              </div>
              <div className="flex gap-1">
                <CyberButton size="sm" variant="ghost" onClick={() => action.mutate({ cpanelUser: a.user, action: 'login' })}><ExternalLink className="w-4 h-4" /></CyberButton>
                <CyberButton size="sm" variant="ghost" onClick={() => action.mutate({ cpanelUser: a.user, action: 'reset' })}><RefreshCw className="w-4 h-4" /></CyberButton>
                <CyberButton size="sm" variant="ghost" onClick={() => action.mutate({ cpanelUser: a.user, action: a.suspended ? 'resume' : 'suspend' })}><Power className="w-4 h-4" /></CyberButton>
                <CyberButton size="sm" variant="danger" onClick={() => { if (confirm('Delete ' + a.domain + '?')) action.mutate({ cpanelUser: a.user, action: 'terminate' }); }}><Trash2 className="w-4 h-4" /></CyberButton>
              </div>
            </CyberCard>
          ))}
          {accounts.length === 0 && <CyberCard className="p-6 text-center text-t3">No hosting accounts yet.</CyberCard>}
        </div>
      </div>
    </div>
  );
}

// ─── Subscribe / plan selection ─────────────────────────────────────────────────
function SubscribePane({ plans, onDone, embedded }: { plans: Plan[]; onDone: () => void; embedded?: boolean }) {
  const { toast } = useToast();
  const [coupon, setCoupon] = useState('');
  const [couponInfo, setCouponInfo] = useState<any>(null);
  const subscribe = useMutation({
    mutationFn: (plan: string) => api('/subscribe', { method: 'POST', body: JSON.stringify({ plan, coupon: couponInfo ? coupon : undefined }) }),
    onSuccess: (d) => {
      if (d.ok) { toast({ title: 'Subscribed', description: 'Your hosting plan is active.' }); onDone(); }
      else if (d.code === 'INSUFFICIENT_BALANCE')
        toast({ title: 'Insufficient balance', description: `Need $${d.needed}, you have $${d.current}. Top up your wallet first.`, variant: 'destructive' as any });
      else toast({ title: 'Error', description: d.error || 'Could not subscribe', variant: 'destructive' as any });
    },
  });
  const checkCoupon = useMutation({
    mutationFn: () => api('/coupon?code=' + encodeURIComponent(coupon)),
    onSuccess: (d) => {
      if (d.ok) { setCouponInfo(d); toast({ title: 'Coupon applied', description: d.discount_pct ? `${d.discount_pct}% off` : `$${d.discount_amount} off` }); }
      else { setCouponInfo(null); toast({ title: 'Invalid coupon', description: d.error, variant: 'destructive' as any }); }
    },
  });
  // discounted price for a plan given the applied coupon
  const priced = (p: Plan) => {
    const base = Number(p.price_usd);
    if (!couponInfo) return { final: base, off: 0 };
    let off = 0;
    if (couponInfo.discount_pct) off += base * couponInfo.discount_pct / 100;
    if (couponInfo.discount_amount) off += Number(couponInfo.discount_amount);
    off = Math.min(base, Math.round(off * 100) / 100);
    return { final: Math.round((base - off) * 100) / 100, off };
  };

  return (
    <div className={embedded ? '' : 'p-4 md:p-6 max-w-6xl mx-auto'}>
      <h1 className="text-2xl font-bold text-t1 flex items-center gap-2 mb-2"><Server className="w-6 h-6 text-a1" /> Hosting Panel</h1>
      <p className="text-t3 text-sm mb-4">Secure cPanel hosting with built-in Cloudflare protection — SSL, anti-bot, rate-limiting, DNSSEC, and anti-spoofing DNS records (SPF/DKIM/DMARC) on every domain. Pick a plan to start.</p>
      {/* coupon */}
      <div className="flex items-center gap-2 mb-6 max-w-sm">
        <CyberInput placeholder="Coupon code (optional)" value={coupon}
          onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponInfo(null); }} className="flex-1" />
        <CyberButton size="sm" variant="secondary" isLoading={checkCoupon.isPending} onClick={() => coupon && checkCoupon.mutate()}>Apply</CyberButton>
      </div>
      {couponInfo && <p className="text-xs text-a1 -mt-4 mb-6">✓ Coupon {couponInfo.code} applied — prices below are discounted.</p>}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <CyberCard key={p.id} className="p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-1 text-a1">{PLAN_ICON[p.name] || <Server className="w-5 h-5" />}
              <span className="text-lg font-bold text-t1">{p.display_name}</span></div>
            <div className="text-3xl font-bold text-t1 my-2">
              {priced(p).off > 0 && <span className="text-lg text-t3 line-through mr-2">${Number(p.price_usd).toFixed(0)}</span>}
              ${priced(p).final.toFixed(priced(p).off > 0 ? 2 : 0)}<span className="text-sm text-t3 font-normal">/mo</span>
            </div>
            <CyberBadge variant={p.self_service ? 'default' : 'warning'} className="self-start mb-3">
              {p.self_service ? 'Self-service' : 'Managed by us'}</CyberBadge>
            <ul className="text-sm text-t2 space-y-1.5 flex-1 mb-4">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-a1" /> {p.max_sites} site{p.max_sites > 1 ? 's' : ''}</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-a1" /> {p.max_domains} domains each</li>
              <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-a1" /> SSL + anti-bot + anti-spoofing DNS</li>
              {p.features?.ratelimit && <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-a1" /> Rate-limit + DMARC</li>}
              {p.features?.managed_setup && <li className="flex items-center gap-2"><Crown className="w-4 h-4 text-warn" /> We set everything up for you</li>}
            </ul>
            <CyberButton isLoading={subscribe.isPending && subscribe.variables === p.name}
              onClick={() => subscribe.mutate(p.name)}>Subscribe · ${priced(p).final.toFixed(priced(p).off > 0 ? 2 : 0)}/mo</CyberButton>
          </CyberCard>
        ))}
      </div>
      <p className="text-xs text-t3 mt-4">Paid from your wallet balance. Top up in the Wallet page if you're short.</p>
    </div>
  );
}

// ─── Sites list ─────────────────────────────────────────────────────────────────
function SitesList({ onOpen, selfService, maxSites }: { onOpen: (a: Account) => void; selfService: boolean; maxSites: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const accountsQ = useQuery({ queryKey: ['hp-accounts'], queryFn: () => api('/accounts') });
  const accounts: Account[] = accountsQ.data?.accounts || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-t1">My sites <span className="text-t3 text-sm">({accounts.length}/{maxSites})</span></h2>
        <div className="flex gap-2">
          <CyberButton variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['hp-accounts'] })}><RefreshCw className="w-4 h-4" /></CyberButton>
          {selfService && accounts.length < maxSites &&
            <CyberButton size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> New cPanel</CyberButton>}
        </div>
      </div>

      {accountsQ.isLoading && <div className="text-t3 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading…</div>}

      {!accountsQ.isLoading && accounts.length === 0 && (
        <CyberCard className="p-8 text-center text-t3">
          {selfService
            ? <>No sites yet. Click <b className="text-t1">New cPanel</b> to create your first hosting account.</>
            : <>No sites yet. Your plan is managed — our team will provision your hosting. <a href="/dashboard/support" className="text-a1 underline">Open a ticket</a> with your domain.</>}
        </CyberCard>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {accounts.map((a) => (
          <CyberCard key={a.user} className="p-4 cursor-pointer hover:border-a1/40 transition" onClick={() => onOpen(a)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-a1" />
                <span className="font-bold text-t1">{a.domain}</span></div>
              {a.suspended ? <CyberBadge variant="danger">Suspended</CyberBadge> : <CyberBadge variant="success">Active</CyberBadge>}
            </div>
            <div className="text-xs text-t3 mt-2 font-mono">{a.user} · {a.ip}</div>
          </CyberCard>
        ))}
      </div>

      {creating && <CreateDialog onClose={() => setCreating(false)}
        onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['hp-accounts'] }); }} />}
    </div>
  );
}

// ─── Create cPanel dialog ───────────────────────────────────────────────────────
function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<any>(null);

  const create = useMutation({
    mutationFn: () => api('/create-cpanel', { method: 'POST', body: JSON.stringify({ domain, contactemail: email }) }),
    onSuccess: (d) => {
      if (d.ok) { setResult(d.cpanel); toast({ title: 'cPanel created', description: d.cpanel.domain }); }
      else toast({ title: 'Error', description: d.error || 'Failed', variant: 'destructive' as any });
    },
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <CyberCard className="p-5 w-full max-w-md" onClick={(e: any) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-t1 mb-3">Create a new cPanel</h3>
        {!result ? (
          <div className="space-y-3">
            <div><label className="text-xs text-t3">Domain <span className="text-t3">(optional)</span></label>
              <CyberInput placeholder="leave blank to get a free subdomain" value={domain} onChange={(e) => setDomain(e.target.value)} />
              <p className="text-xs text-t3 mt-1">Skip this to get hosting now on a free subdomain, then link your own domain later from the Domains tab.</p></div>
            <div><label className="text-xs text-t3">Contact email (optional)</label>
              <CyberInput placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="flex gap-2 justify-end pt-2">
              <CyberButton variant="ghost" onClick={onClose}>Cancel</CyberButton>
              <CyberButton isLoading={create.isPending} onClick={() => create.mutate()}>Create</CyberButton>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-a1"><CheckCircle2 className="w-4 h-4" /> Created</div>
            <Field label="Domain" value={result.domain} />
            <Field label="cPanel user" value={result.user} />
            <Field label="Password" value={result.password} copy />
            {result.needsLink && <p className="text-warn text-xs">Now open the site and link this domain from the Domains tab to activate Cloudflare protection.</p>}
            <CyberButton className="w-full mt-2" onClick={onDone}>Done</CyberButton>
          </div>
        )}
      </CyberCard>
    </div>
  );
}

function Field({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between bg-bg3 rounded-md px-3 py-2">
      <span className="text-t3 text-xs">{label}</span>
      <span className="font-mono text-t1 flex items-center gap-2">{value}
        {copy && <Copy className="w-3.5 h-3.5 cursor-pointer text-t3 hover:text-a1"
          onClick={() => { navigator.clipboard.writeText(value); toast({ title: 'Copied' }); }} />}</span>
    </div>
  );
}

// ─── Single site view (tabs) ────────────────────────────────────────────────────
const TABS = ['Open', 'Domains', 'Protection', 'Manage'] as const;
type Tab = typeof TABS[number];

function SiteView({ account, selfService, onBack }: { account: Account; selfService: boolean; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('Open');
  return (
    <div>
      <CyberButton variant="ghost" size="sm" onClick={onBack} className="mb-3"><ArrowLeft className="w-4 h-4" /> Back to my sites</CyberButton>
      <div className="flex items-center gap-2 mb-4"><Globe className="w-5 h-5 text-a1" />
        <span className="text-xl font-bold text-t1">{account.domain}</span>
        <span className="text-t3 text-sm font-mono">({account.user})</span></div>
      <div className="flex gap-1 border-b border-border mb-4">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition',
              tab === t ? 'border-a1 text-a1' : 'border-transparent text-t3 hover:text-t1')}>{t}</button>
        ))}
      </div>
      {tab === 'Open' && <OpenTab account={account} />}
      {tab === 'Domains' && <DomainsTab account={account} selfService={selfService} />}
      {tab === 'Protection' && <ProtectionTab account={account} />}
      {tab === 'Manage' && <ManageTab account={account} onBack={onBack} />}
    </div>
  );
}

function OpenTab({ account }: { account: Account }) {
  const { toast } = useToast();
  const open = useMutation({
    mutationFn: () => api('/cpanel-login', { method: 'POST', body: JSON.stringify({ cpanelUser: account.user }) }),
    onSuccess: (d) => { if (d.ok && d.url) window.open(d.url, '_blank'); else toast({ title: 'Error', description: d.error, variant: 'destructive' as any }); },
  });
  return (
    <CyberCard className="p-5">
      <h3 className="font-bold text-t1 mb-2">Open cPanel</h3>
      <p className="text-t3 text-sm mb-4">One-click login to your cPanel control panel — no password needed.</p>
      <CyberButton isLoading={open.isPending} onClick={() => open.mutate()}><ExternalLink className="w-4 h-4" /> Open cPanel now</CyberButton>
    </CyberCard>
  );
}

function DomainsTab({ account, selfService }: { account: Account; selfService: boolean }) {
  const { toast } = useToast();
  const [domain, setDomain] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [ns, setNs] = useState<string[]>([]);
  const link = useMutation({
    mutationFn: () => api('/link-domain', { method: 'POST', body: JSON.stringify({ domain, cpanelUser: account.user }) }),
    onSuccess: (d) => {
      setLog(d.log || []);
      setNs(d.zone?.nameservers || []);
      if (d.ok) toast({ title: 'Domain linked + protected' });
      else toast({ title: 'Partial', description: d.error, variant: 'destructive' as any });
    },
  });
  if (!selfService) return <CyberCard className="p-5 text-t3">Your plan is managed — our team links domains for you. Open a ticket with the domain you want linked.</CyberCard>;
  return (
    <CyberCard className="p-5 space-y-3">
      <h3 className="font-bold text-t1">Link a domain</h3>
      <p className="text-t3 text-sm">Adds the domain to Cloudflare, points DNS here, and applies SSL, anti-bot, SPF/DKIM/DMARC automatically.</p>
      <div className="flex gap-2">
        <CyberInput placeholder="yourdomain.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="flex-1" />
        <CyberButton isLoading={link.isPending} onClick={() => link.mutate()}>Link + protect</CyberButton>
      </div>
      {ns.length > 0 && (
        <div className="bg-bg3 rounded-md p-3 text-sm">
          <div className="text-t1 font-bold mb-1">Set these nameservers at your registrar:</div>
          {ns.map((n) => <div key={n} className="font-mono text-a1">➜ {n}</div>)}
        </div>
      )}
      {log.length > 0 && <div className="bg-bg2 rounded-md p-3 text-xs font-mono text-t3 space-y-0.5 max-h-48 overflow-auto">
        {log.map((l, i) => <div key={i}>{l}</div>)}</div>}
    </CyberCard>
  );
}

function ProtectionTab({ account }: { account: Account }) {
  const { toast } = useToast();
  const stateQ = useQuery({ queryKey: ['hp-prot', account.user], queryFn: () => api('/protection?cpanelUser=' + account.user) });
  const s = stateQ.data;
  const act = (path: string) => api(path, { method: 'POST', body: JSON.stringify({ cpanelUser: account.user }) });
  const mk = (path: string, label: string) => useMutation({
    mutationFn: () => act(path),
    onSuccess: (d) => { toast({ title: label, description: d.ok ? 'Applied' : (d.error || d.antibot || d.ratelimit || 'Done') }); stateQ.refetch(); },
  });
  const antibot = mk('/antibot-apply', 'Anti-bot');
  const ratelimit = mk('/ratelimit-apply', 'Rate limit');
  const dkim = mk('/dkim-apply', 'DKIM');
  const dmarc = mk('/dmarc-advance', 'DMARC');

  if (stateQ.isLoading) return <div className="text-t3 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (s && !s.onCloudflare) return <CyberCard className="p-5 text-t3">This domain isn't on Cloudflare yet. Link it in the Domains tab first.</CyberCard>;
  const st = s?.state || {};
  return (
    <div className="space-y-3">
      <CyberCard className="p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="SSL" value={st.ssl} />
          <Stat label="Security level" value={st.security_level} />
          <Stat label="Always HTTPS" value={st.always_use_https} />
          <Stat label="Anti-bot" value={st.antibot ? 'on' : 'off'} good={st.antibot} />
          <Stat label="Rate-limit" value={st.ratelimit ? 'on' : 'off'} good={st.ratelimit} />
          <Stat label="DMARC" value={st.dmarc || 'none'} />
        </div>
      </CyberCard>
      <div className="grid md:grid-cols-2 gap-3">
        <ActionRow icon={<Shield />} title="Anti-bot protection" desc="Challenge bots, let humans through" btn="Apply" onClick={() => antibot.mutate()} loading={antibot.isPending} />
        <ActionRow icon={<Lock />} title="Rate limiting" desc="Block brute-force on login paths" btn="Apply" onClick={() => ratelimit.mutate()} loading={ratelimit.isPending} />
        <ActionRow icon={<CheckCircle2 />} title="Anti-spoofing (DKIM)" desc="Sign your domain's DNS so it can't be forged" btn="Set up" onClick={() => dkim.mutate()} loading={dkim.isPending} />
        <ActionRow icon={<AlertTriangle />} title="Advance DMARC" desc="none → quarantine → reject" btn="Advance" onClick={() => dmarc.mutate()} loading={dmarc.isPending} />
      </div>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: any; good?: boolean }) {
  return <div className="flex items-center justify-between bg-bg3 rounded px-3 py-1.5">
    <span className="text-t3">{label}</span>
    <span className={cn('font-mono font-bold', good ? 'text-a1' : 'text-t1')}>{value ?? '—'}</span></div>;
}

function ActionRow({ icon, title, desc, btn, onClick, loading }: any) {
  return (
    <CyberCard className="p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="text-a1">{icon}</div>
        <div><div className="font-bold text-t1 text-sm">{title}</div><div className="text-t3 text-xs">{desc}</div></div>
      </div>
      <CyberButton size="sm" isLoading={loading} onClick={onClick}>{btn}</CyberButton>
    </CyberCard>
  );
}

function ManageTab({ account, onBack }: { account: Account; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newPass, setNewPass] = useState('');
  const reset = useMutation({ mutationFn: () => api('/reset-password', { method: 'POST', body: JSON.stringify({ cpanelUser: account.user }) }),
    onSuccess: (d) => { if (d.ok) { setNewPass(d.password); toast({ title: 'Password reset' }); } } });
  const suspend = useMutation({ mutationFn: (on: boolean) => api('/suspend', { method: 'POST', body: JSON.stringify({ cpanelUser: account.user, on }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hp-accounts'] }) });
  const fixperms = useMutation({ mutationFn: () => api('/fix-permissions', { method: 'POST', body: JSON.stringify({ cpanelUser: account.user }) }),
    onSuccess: (d) => toast({ title: 'Permissions', description: d.note }) });
  const terminate = useMutation({ mutationFn: () => api('/terminate', { method: 'POST', body: JSON.stringify({ cpanelUser: account.user }) }),
    onSuccess: () => { toast({ title: 'Deleted' }); qc.invalidateQueries({ queryKey: ['hp-accounts'] }); onBack(); } });

  return (
    <CyberCard className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div><div className="font-bold text-t1 text-sm">Reset password</div><div className="text-t3 text-xs">Generate a fresh cPanel password</div></div>
        <CyberButton size="sm" variant="secondary" isLoading={reset.isPending} onClick={() => reset.mutate()}><RefreshCw className="w-4 h-4" /> Reset</CyberButton>
      </div>
      {newPass && <Field label="New password" value={newPass} copy />}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div><div className="font-bold text-t1 text-sm">{account.suspended ? 'Resume' : 'Suspend'}</div><div className="text-t3 text-xs">Temporarily disable the account</div></div>
        <CyberButton size="sm" variant="secondary" isLoading={suspend.isPending} onClick={() => suspend.mutate(!account.suspended)}><Power className="w-4 h-4" /> {account.suspended ? 'Resume' : 'Suspend'}</CyberButton>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div><div className="font-bold text-t1 text-sm">Fix permissions</div><div className="text-t3 text-xs">Repair 0555 folders that block editing/uploads</div></div>
        <CyberButton size="sm" variant="secondary" isLoading={fixperms.isPending} onClick={() => fixperms.mutate()}><Wrench className="w-4 h-4" /> Fix</CyberButton>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div><div className="font-bold text-danger text-sm">Delete account</div><div className="text-t3 text-xs">Permanently terminate this cPanel</div></div>
        <CyberButton size="sm" variant="danger" isLoading={terminate.isPending}
          onClick={() => { if (confirm('Permanently delete ' + account.domain + '? This cannot be undone.')) terminate.mutate(); }}><Trash2 className="w-4 h-4" /> Delete</CyberButton>
      </div>
    </CyberCard>
  );
}
