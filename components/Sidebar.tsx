'use client';

import Link from '@/components/ui/AppLink';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Shield, Image,
  Tag, SlidersHorizontal, RefreshCw, Globe, Files,
  Beef, Package, Pill, Heart, UserCheck, Receipt, TrendingUp, ShoppingCart, Utensils,
  Ruler, Wheat, FlaskConical, BookOpen, List, Scale, Wallet,
  Syringe, Layers, ShieldPlus, Stethoscope, ScrollText, BookMarked,
  ArrowLeftRight, Store, Handshake, Warehouse, Dna, ChevronDown, X, History,
  Building2, Banknote, PanelTopOpen, Briefcase, AlertTriangle,
  GitBranch, Flame, HeartHandshake, Baby, TestTube,
  Milk, ClipboardList, Droplets, Recycle, Settings2, PieChart, Search, MessageCircle, Radio, Languages,
  Sparkles, FileText, Bot,
  Mic,
} from 'lucide-react';
import { useState } from 'react';
import { useAiStatus } from '@/lib/ai';

interface StaticNavItem {
  name: string;
  title: string;
  icon: React.ReactNode;
  url?: string;
  permission?: string;
  /** Starts a new labelled block in the menu (main, farm, business, system). */
  section?: string;
  /** Accent of a top-level item: its icon chip, and a tint on its sub-items. */
  color?: string;
  children?: StaticNavItem[];
}

const NAV: StaticNavItem[] = [
  {
    name: 'dashboard',
    color: '#34d399',
    section: 'main',
    title: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    url: '/dashboard',
    permission: 'dashboard.view',
  },
  {
    name: 'ai',
    color: '#c4b5fd',
    title: 'AI',
    icon: <Sparkles size={18} />,
    permission: 'ai.assistant.use',
    children: [
      { name: 'ai-assistant', title: 'Farm Assistant', icon: <Bot size={18} />, url: '/ai/assistant', permission: 'ai.assistant.use' },
      { name: 'ai-voice', title: 'Voice Entry', icon: <Mic size={18} />, url: '/ai/voice', permission: 'ai.voice.use' },
      { name: 'ai-reports', title: 'Monthly Reports', icon: <FileText size={18} />, url: '/ai/reports', permission: 'ai.reports.view' },
    ],
  },
  {
    name: 'animal-management',
    color: '#fbbf24',
    section: 'farm',
    title: 'Animal Management',
    icon: <Beef size={18} />,
    permission: 'farm.cattle.view',
    children: [
      { name: 'animal-management-cattle', title: 'Cattle', icon: <Beef size={18} />, url: '/farm/cattle', permission: 'farm.cattle.view' },
      { name: 'animal-management-types', title: 'Animal Types', icon: <Tag size={18} />, url: '/farm/master-data/animal-types', permission: 'animal-type.view' },
      { name: 'animal-management-age-categories', title: 'Age Categories', icon: <History size={18} />, url: '/farm/master-data/age-categories', permission: 'animal-type.view' },
      { name: 'animal-management-sheds', title: 'Sheds', icon: <Warehouse size={18} />, url: '/farm/master-data/sheds', permission: 'farm.sheds.view' },
      { name: 'animal-management-breeds', title: 'Breeds', icon: <Dna size={18} />, url: '/farm/master-data/breeds', permission: 'farm.cattle.view' },
      { name: 'animal-management-collars', title: 'Smart Collars', icon: <Radio size={18} />, url: '/farm/collars', permission: 'farm.cattle.view' },
    ],
  },
  {
    name: 'feed-management',
    color: '#a3e635',
    title: 'Feed Management',
    icon: <Package size={18} />,
    permission: 'farm.feed.view',
    children: [
      { name: 'feed-overview', title: 'Overview', icon: <Package size={18} />, url: '/farm/feed', permission: 'farm.feed.view' },
      { name: 'feed-categories', title: 'Categories', icon: <Tag size={18} />, url: '/farm/feed/categories', permission: 'farm.feed.view' },
      { name: 'feed-items', title: 'Food Items', icon: <Wheat size={18} />, url: '/farm/feed/items', permission: 'farm.feed.view' },
      { name: 'feed-purchases', title: 'Purchases', icon: <ShoppingCart size={18} />, url: '/farm/feed/purchases', permission: 'farm.feed.view' },
      { name: 'feed-lots', title: 'Batch Stock', icon: <Layers size={18} />, url: '/farm/feed/lots', permission: 'farm.feed.view' },
      { name: 'feed-daily', title: 'Daily Feeding', icon: <Utensils size={18} />, url: '/farm/feed/daily', permission: 'farm.feed.view' },
      { name: 'feed-formulations', title: 'Formulations', icon: <FlaskConical size={18} />, url: '/farm/feed/formulations', permission: 'farm.feed.view' },
      { name: 'feed-batches', title: 'Mix Batches', icon: <Layers size={18} />, url: '/farm/feed/batches', permission: 'farm.feed.view' },
      { name: 'feed-adjustments', title: 'Wastage / Loss', icon: <AlertTriangle size={18} />, url: '/farm/feed/adjustments', permission: 'farm.feed.view' },
    ],
  },
  {
    name: 'medicine',
    color: '#fb7185',
    title: 'Medicine',
    icon: <Pill size={18} />,
    permission: 'farm.medicine.view',
    children: [
      { name: 'medicine-overview', title: 'Overview', icon: <Package size={18} />, url: '/farm/medicine', permission: 'farm.medicine.view' },
      { name: 'medicine-categories', title: 'Categories', icon: <Tag size={18} />, url: '/farm/medicine/categories', permission: 'farm.medicine.view' },
      { name: 'medicine-inventory', title: 'Inventory', icon: <Pill size={18} />, url: '/farm/medicine/inventory', permission: 'farm.medicine.view' },
      { name: 'medicine-purchases', title: 'Purchases', icon: <ShoppingCart size={18} />, url: '/farm/medicine/purchases', permission: 'farm.medicine.view' },
      { name: 'medicine-batches', title: 'Batch Stock', icon: <Layers size={18} />, url: '/farm/medicine/batches', permission: 'farm.medicine.view' },
      { name: 'medicine-usage', title: 'Usage', icon: <Syringe size={18} />, url: '/farm/medicine/usage', permission: 'farm.medicine.view' },
      { name: 'medicine-adjustments', title: 'Wastage / Loss', icon: <AlertTriangle size={18} />, url: '/farm/medicine/adjustments', permission: 'farm.medicine.view' },
    ],
  },
  {
    name: 'health',
    color: '#f472b6',
    title: 'Health',
    icon: <Heart size={18} />,
    permission: 'farm.health.view',
    children: [
      { name: 'health-vaccines', title: 'Vaccines', icon: <ShieldPlus size={18} />, url: '/farm/health/vaccines', permission: 'farm.health.view' },
      { name: 'health-treatments', title: 'Treatments', icon: <Stethoscope size={18} />, url: '/farm/health/treatments', permission: 'farm.health.view' },
    ],
  },
  {
    name: 'breeding',
    color: '#c084fc',
    title: 'Breeding',
    icon: <GitBranch size={18} />,
    permission: 'farm.breeding.view',
    children: [
      { name: 'breeding-overview', title: 'Overview', icon: <LayoutDashboard size={18} />, url: '/farm/breeding', permission: 'farm.breeding.view' },
      { name: 'breeding-services', title: 'Services', icon: <HeartHandshake size={18} />, url: '/farm/breeding/services', permission: 'farm.breeding.view' },
      { name: 'breeding-heats', title: 'Heats', icon: <Flame size={18} />, url: '/farm/breeding/heats', permission: 'farm.breeding.view' },
      { name: 'breeding-births', title: 'Deliveries', icon: <Baby size={18} />, url: '/farm/breeding/births', permission: 'farm.breeding.view' },
      { name: 'breeding-semen', title: 'Semen Stock', icon: <TestTube size={18} />, url: '/farm/breeding/semen', permission: 'farm.breeding.view' },
    ],
  },
  {
    name: 'dairy',
    color: '#38bdf8',
    title: 'Dairy',
    icon: <Milk size={18} />,
    permission: 'farm.dairy.view',
    children: [
      { name: 'dairy-overview', title: 'Overview', icon: <LayoutDashboard size={18} />, url: '/farm/dairy', permission: 'farm.dairy.view' },
      { name: 'dairy-milk', title: 'Daily Milk', icon: <ClipboardList size={18} />, url: '/farm/dairy/milk', permission: 'farm.dairy.view' },
      { name: 'dairy-sales', title: 'Milk Sales', icon: <TrendingUp size={18} />, url: '/farm/dairy/sales', permission: 'farm.dairy.view' },
      { name: 'dairy-lactations', title: 'Lactations', icon: <History size={18} />, url: '/farm/dairy/lactations', permission: 'farm.dairy.view' },
      { name: 'dairy-usages', title: 'Other Usage', icon: <Droplets size={18} />, url: '/farm/dairy/usages', permission: 'farm.dairy.view' },
    ],
  },
  {
    name: 'byproducts',
    color: '#2dd4bf',
    title: 'By-products',
    icon: <Recycle size={18} />,
    permission: 'farm.byproducts.view',
    children: [
      { name: 'byproducts-overview', title: 'Overview', icon: <LayoutDashboard size={18} />, url: '/farm/byproducts', permission: 'farm.byproducts.view' },
      { name: 'byproducts-records', title: 'Production', icon: <ClipboardList size={18} />, url: '/farm/byproducts/records', permission: 'farm.byproducts.view' },
      { name: 'byproducts-sales', title: 'Sales', icon: <TrendingUp size={18} />, url: '/farm/byproducts/sales', permission: 'farm.byproducts.view' },
      { name: 'byproducts-usages', title: 'Own Use', icon: <Droplets size={18} />, url: '/farm/byproducts/usages', permission: 'farm.byproducts.view' },
      { name: 'byproducts-settings', title: 'Products & Units', icon: <Settings2 size={18} />, url: '/farm/byproducts/settings', permission: 'farm.byproducts.view' },
    ],
  },
  {
    name: 'labour',
    color: '#fb923c',
    title: 'Labour',
    icon: <UserCheck size={18} />,
    permission: 'farm.labour.view',
    children: [
      { name: 'labour-employees', title: 'Employees', icon: <UserCheck size={18} />, url: '/farm/labour/employees', permission: 'farm.labour.view' },
      { name: 'labour-daily', title: 'Daily Labour', icon: <Users size={18} />, url: '/farm/labour/daily', permission: 'farm.labour.view' },
    ],
  },
  {
    name: 'sales-expenses',
    color: '#4ade80',
    section: 'business',
    title: 'Sales & Expenses',
    icon: <Banknote size={18} />,
    children: [
      { name: 'expenses', title: 'Expenses', icon: <Receipt size={18} />, url: '/farm/expenses', permission: 'farm.expenses.view' },
      { name: 'sales', title: 'Sales', icon: <TrendingUp size={18} />, url: '/farm/sales', permission: 'farm.sales.view' },
      { name: 'assets', title: 'Fixed Assets', icon: <Layers size={18} />, url: '/farm/assets', permission: 'farm.assets.view' },
      { name: 'profit-centers', title: 'Profit Centers', icon: <PieChart size={18} />, url: '/farm/reports/profit-centers', permission: 'farm.reports.view' },
    ],
  },
  {
    name: 'stakeholders',
    color: '#818cf8',
    title: 'Stakeholders',
    icon: <Briefcase size={18} />,
    children: [
      { name: 'suppliers', title: 'Suppliers', icon: <Store size={18} />, url: '/suppliers', permission: 'suppliers.view' },
      { name: 'supplier-types', title: 'Supplier Types', icon: <Tag size={18} />, url: '/suppliers/types', permission: 'suppliers.view' },
      { name: 'customers', title: 'Customers', icon: <Users size={18} />, url: '/customers', permission: 'customers.view' },
      { name: 'customer-types', title: 'Customer Types', icon: <Tag size={18} />, url: '/customers/types', permission: 'customers.view' },
      { name: 'partners', title: 'Partners & Investment', icon: <Handshake size={18} />, url: '/partners', permission: 'partners.view' },
    ],
  },
  {
    name: 'accounting',
    color: '#22d3ee',
    title: 'Finance & Accounts',
    icon: <BookOpen size={18} />,
    permission: 'accounting.view',
    children: [
      { name: 'accounting-summary', title: 'Summary', icon: <LayoutDashboard size={18} />, url: '/accounting', permission: 'accounting.view' },
      { name: 'accounting-accounts', title: 'Chart of Accounts', icon: <List size={18} />, url: '/accounting/accounts', permission: 'accounting.view' },
      { name: 'accounting-entries', title: 'Ledger', icon: <BookMarked size={18} />, url: '/accounting/entries', permission: 'accounting.view' },
      { name: 'accounting-trial-balance', title: 'Trial Balance', icon: <Scale size={18} />, url: '/accounting/trial-balance', permission: 'accounting.view' },
      { name: 'accounting-balance-sheet', title: 'Balance Sheet', icon: <Building2 size={18} />, url: '/accounting/balance-sheet', permission: 'accounting.view' },
      { name: 'accounting-payment-accounts', title: 'Cash & Bank Accounts', icon: <Wallet size={18} />, url: '/accounting/payment-accounts', permission: 'accounting.view' },
      { name: 'accounting-transfers', title: 'Account Transfers', icon: <ArrowLeftRight size={18} />, url: '/accounting/transfers', permission: 'accounting.manage' },
    ],
  },
  {
    name: 'units',
    color: '#facc15',
    title: 'Units',
    icon: <Ruler size={18} />,
    url: '/farm/units',
    permission: 'farm.feed.view',
  },
  {
    name: 'user-management',
    color: '#60a5fa',
    section: 'system',
    title: 'User Management',
    icon: <Users size={18} />,
    permission: 'users.view',
    children: [
      { name: 'users', title: 'Users', icon: <Users size={18} />, url: '/users', permission: 'users.view' },
      { name: 'roles', title: 'Roles & Permissions', icon: <Shield size={18} />, url: '/roles', permission: 'roles.view' },
      { name: 'dashboard-sections', title: 'Dashboard Sections', icon: <PanelTopOpen size={18} />, url: '/settings/dashboard-sections', permission: 'roles.edit' },
    ],
  },
  {
    name: 'media-library',
    color: '#e879f9',
    title: 'Media',
    icon: <Image size={18} />,
    permission: 'media.view',
    children: [
      { name: 'media-assets', title: 'Assets', icon: <Files size={18} />, url: '/media/assets', permission: 'media.view' },
      { name: 'media-categories', title: 'Categories', icon: <Tag size={18} />, url: '/media/categories', permission: 'media.categories.view' },
    ],
  },
  {
    name: 'other-settings',
    color: '#a5b4fc',
    title: 'Other Settings',
    icon: <SlidersHorizontal size={18} />,
    permission: 'settings.view',
    children: [
      { name: 'cache-management', title: 'Cache Management', icon: <RefreshCw size={18} />, url: '/other-settings/cache', permission: 'cache.clear' },
      { name: 'website-settings', title: 'Website Settings', icon: <Globe size={18} />, url: '/other-settings/website', permission: 'settings.view' },
      { name: 'whatsapp-alerts', title: 'WhatsApp', icon: <MessageCircle size={18} />, url: '/other-settings/whatsapp', permission: 'settings.view' },
      { name: 'ai-settings', title: 'AI Settings', icon: <Sparkles size={18} />, url: '/other-settings/ai', permission: 'settings.view' },
      { name: 'languages', title: 'Languages', icon: <Languages size={18} />, url: '/other-settings/languages', permission: 'settings.view' },
    ],
  },
  {
    name: 'logs',
    color: '#fdba74',
    title: 'Logs',
    icon: <ScrollText size={18} />,
    permission: 'logs.view',
    children: [
      { name: 'activity-logs', title: 'Activity Logs', icon: <History size={18} />, url: '/activity-logs', permission: 'logs.view' },
    ],
  },
];

/**
 * Menu groups switched off in settings. The AI group stays hidden until its
 * status is known, so a hidden menu never flashes in.
 */
function useHiddenGroups(): Set<string> {
  const { data: ai } = useAiStatus();
  return new Set(ai?.show_in_menu ? [] : ['ai']);
}

/** Sets the item's accent colour for the sidebar CSS (--c). */
function accent(color?: string): React.CSSProperties | undefined {
  return color ? ({ '--c': color } as React.CSSProperties) : undefined;
}

function isActiveUrl(pathname: string, url?: string): boolean {
  if (!url) return false;
  return pathname === url
    || (pathname.startsWith(url + '/') && /^\d+/.test(pathname.slice(url.length + 1)));
}

/** The group whose pages include this path — the one open by default. */
function groupFor(pathname: string): string | null {
  return NAV.find(i => i.children?.some(c => c.url && pathname.startsWith(c.url)))?.name ?? null;
}

function NavItem({
  item,
  onNavigate,
  open,
  onToggle,
}: {
  item: StaticNavItem;
  onNavigate?: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const { t } = useTranslation('layout');

  const visibleChildren = (item.children ?? []).filter(
    c => !c.permission || hasPermission(c.permission)
  );
  const hasActiveChild = visibleChildren.some(c => isActiveUrl(pathname, c.url));

  if (item.permission && !hasPermission(item.permission)) return null;
  const label = t(`menu.${item.name}`, { defaultValue: item.title });

  if (visibleChildren.length > 0) {
    return (
      <div style={accent(item.color)}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`sb-link ${open ? 'open' : ''} ${hasActiveChild ? 'has-active' : ''}`}
        >
          <span className="sb-chip">{item.icon}</span>
          <span className="flex-1 truncate">{label}</span>
          <ChevronDown size={15} className={`shrink-0 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className={`sb-collapse ${open ? 'open' : ''}`}>
          <div>
            <div className="relative ms-[1.55rem] mt-0.5 mb-1 ps-2.5 border-s border-white/10 space-y-0.5">
              {visibleChildren.map(child => (
                <Link
                  key={child.name}
                  href={child.url ?? '#'}
                  prefetch={false}
                  onClick={onNavigate}
                  tabIndex={open ? undefined : -1}
                  className={`sb-sub relative ${isActiveUrl(pathname, child.url) ? 'active' : ''}`}
                >
                  {child.icon}
                  <span className="truncate">{t(`menu.${child.name}`, { defaultValue: child.title })}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item.url) return null;

  return (
    <Link
      href={item.url}
      prefetch={false}
      onClick={onNavigate}
      className={`sb-link ${isActiveUrl(pathname, item.url) ? 'active' : ''}`}
      style={accent(item.color)}
    >
      <span className="sb-chip">{item.icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** Flat list of the pages whose name (or group name) matches the search. */
function SearchResults({ query, onNavigate }: { query: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const { t } = useTranslation('layout');
  const hidden = useHiddenGroups();
  const q = query.trim().toLowerCase();
  const can = (i: StaticNavItem) => !hidden.has(i.name) && (!i.permission || hasPermission(i.permission));

  const results: { item: StaticNavItem; group?: string; color?: string }[] = [];
  for (const top of NAV) {
    if (!can(top)) continue;
    const topLabel = t(`menu.${top.name}`, { defaultValue: top.title });
    if (!top.children) {
      if (topLabel.toLowerCase().includes(q)) results.push({ item: top, color: top.color });
      continue;
    }
    for (const child of top.children) {
      if (!can(child)) continue;
      const label = t(`menu.${child.name}`, { defaultValue: child.title });
      if (label.toLowerCase().includes(q) || topLabel.toLowerCase().includes(q)) results.push({ item: child, group: topLabel, color: top.color });
    }
  }

  if (results.length === 0) {
    return <p className="px-3 py-6 text-center text-xs text-[var(--sb-muted)]">{t('sidebar.no_results', { defaultValue: 'Nothing found' })}</p>;
  }

  return (
    <div className="space-y-0.5">
      {results.map(({ item, group, color }) => (
        <Link
          key={item.name}
          style={accent(color)}
          href={item.url ?? '#'}
          prefetch={false}
          onClick={onNavigate}
          className={`sb-sub relative ${isActiveUrl(pathname, item.url) ? 'active' : ''}`}
        >
          {item.icon}
          <span className="min-w-0">
            <span className="block truncate">{t(`menu.${item.name}`, { defaultValue: item.title })}</span>
            {group && <span className="block truncate text-[0.68rem] text-[var(--sb-muted)]">{group}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { t } = useTranslation('layout');
  const { hasPermission } = useAuth();
  const [query, setQuery] = useState('');

  // One group open at a time (accordion): opening a group closes the others.
  // Moving to a page in another group opens that group.
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(() => groupFor(pathname));
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    const g = groupFor(pathname);
    if (g) setOpenGroup(g);
    // A search that led to this page is done; the menu reopens as the full list.
    setQuery('');
  }

  const hidden = useHiddenGroups();
  const canSee = (i: StaticNavItem) =>
    !hidden.has(i.name)
    && (!i.permission || hasPermission(i.permission))
    && (!i.children || i.children.some(c => !c.permission || hasPermission(c.permission)));

  // Section headings only appear when at least one item under them is visible.
  const blocks: { section?: string; items: StaticNavItem[] }[] = [];
  for (const item of NAV) {
    if (item.section || blocks.length === 0) blocks.push({ section: item.section, items: [] });
    blocks[blocks.length - 1].items.push(item);
  }

  return (
    <div className="sb flex flex-col h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Brand */}
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4">
        <Link href="/dashboard" onClick={onClose} title={t('sidebar.go_home', { defaultValue: 'Dashboard' })}
          className="group flex items-center gap-3 min-w-0 rounded-xl -m-1.5 p-1.5 hover:bg-white/[0.05] transition-colors">
          <div className="relative shrink-0 transition-transform group-hover:scale-105">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-400/40 to-teal-400/10 blur-md" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="relative w-10 h-10 rounded-xl ring-1 ring-white/15" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--sb-text-strong)] leading-tight truncate">{t('brand')}</p>
            <p className="text-[0.7rem] text-[#6ee7b7]/80 leading-tight truncate">{t('sidebar.tagline', { defaultValue: 'Farm management' })}</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden grid place-items-center w-10 h-10 -me-1 rounded-lg text-[var(--sb-text)] hover:bg-white/10 hover:text-white" aria-label={t('sidebar.close_menu')}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Menu search */}
      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 h-10 lg:h-9 px-3 rounded-xl bg-white/[0.05] ring-1 ring-white/[0.07] focus-within:ring-emerald-400/50 transition">
          <Search size={15} className="shrink-0 text-[var(--sb-muted)]" />
          <input
            type="search"
            name="menu-search"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('sidebar.search', { defaultValue: 'Search menu…' })}
            className="w-full bg-transparent text-[0.82rem] text-[var(--sb-text-strong)] placeholder:text-[var(--sb-muted)] focus:outline-none focus-visible:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="grid place-items-center w-8 h-8 -me-2 shrink-0 text-[var(--sb-muted)] hover:text-white" aria-label={t('sidebar.clear_search')}>
              <X size={14} />
            </button>
          )}
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {query.trim() ? (
          <div className="pt-2"><SearchResults query={query} onNavigate={onClose} /></div>
        ) : (
          blocks.map((block, i) => {
            if (!block.items.some(canSee)) return null;
            return (
              <div key={block.section ?? i}>
                {block.section && <p className="sb-section">{t(`sidebar.sections.${block.section}`, { defaultValue: block.section })}</p>}
                <div className="space-y-0.5">
                  {block.items.filter(canSee).map(item => (
                    <NavItem key={item.name} item={item} onNavigate={onClose}
                      open={openGroup === item.name}
                      onToggle={() => setOpenGroup(g => (g === item.name ? null : item.name))} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
