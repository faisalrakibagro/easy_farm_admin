import type { ElementType } from 'react';
import { Baby, Milk, Package, Plus, Receipt, Recycle, ShoppingCart, Stethoscope, Syringe, TrendingUp, Users, Utensils } from 'lucide-react';

/**
 * The everyday entries offered as shortcuts: on the dashboard and in the
 * phone's bottom bar (+). Each opens its page's "new" form through `?new=…`,
 * except milk entry, which opens the milk modal in place. Labels are
 * `dashboard:quick_actions.<key>`; each shows only with its permission.
 */
export interface QuickAction { key: string; href?: string; modal?: 'milk'; icon: ElementType; perm: string; tone: string }

export const QUICK_ACTION_DEFS: QuickAction[] = [
  { key: 'milk_entry',     modal: 'milk',                    icon: Milk,         perm: 'farm.dairy.create',      tone: 'from-sky-400 to-blue-600 shadow-sky-500/30' },
  { key: 'daily_feeding',  href: '/farm/feed/daily?new=1',         icon: Utensils,     perm: 'farm.feed.create',         tone: 'from-lime-400 to-green-600 shadow-lime-500/30' },
  { key: 'medicine_usage', href: '/farm/cattle?new=medicine',      icon: Syringe,      perm: 'farm.medicine.create',     tone: 'from-rose-400 to-pink-600 shadow-rose-500/30' },
  { key: 'treatment',      href: '/farm/health/treatments?new=1',  icon: Stethoscope,  perm: 'farm.health.create',       tone: 'from-fuchsia-400 to-purple-600 shadow-fuchsia-500/30' },
  { key: 'daily_labour',   href: '/farm/labour/daily?new=1',       icon: Users,        perm: 'farm.labour.create',       tone: 'from-orange-400 to-amber-600 shadow-orange-500/30' },
  { key: 'add_expense',    href: '/farm/expenses?new=1',           icon: Receipt,      perm: 'farm.expenses.create',     tone: 'from-red-400 to-rose-600 shadow-red-500/30' },
  { key: 'milk_sale',      href: '/farm/dairy/sales?new=1',        icon: TrendingUp,   perm: 'farm.dairy.create',        tone: 'from-cyan-400 to-sky-600 shadow-cyan-500/30' },
  { key: 'sell_cattle',    href: '/farm/cattle?new=sell',          icon: ShoppingCart, perm: 'farm.sales.create',        tone: 'from-emerald-400 to-teal-600 shadow-emerald-500/30' },
  { key: 'feed_purchase',  href: '/farm/feed/purchases?new=1',     icon: Package,      perm: 'farm.feed.create',         tone: 'from-yellow-400 to-amber-500 shadow-yellow-500/30' },
  { key: 'delivery',       href: '/farm/breeding/births?new=1',    icon: Baby,         perm: 'farm.breeding.create',     tone: 'from-violet-400 to-indigo-600 shadow-violet-500/30' },
  { key: 'byproduct_sale', href: '/farm/byproducts/sales?new=1',   icon: Recycle,      perm: 'farm.byproducts.create',   tone: 'from-teal-400 to-cyan-600 shadow-teal-500/30' },
  { key: 'add_cattle',     href: '/farm/cattle?new=cattle',        icon: Plus,         perm: 'farm.cattle.create',       tone: 'from-indigo-400 to-blue-600 shadow-indigo-500/30' },
];
