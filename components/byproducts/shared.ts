'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Byproduct, ByproductUnit } from '@/types';
import { fmtNum } from '@/lib/format';

/** By-products (with unit, species and usage counts) and the units to measure them in. */
export function useByproducts() {
  const products = useQuery({
    queryKey: ['byproducts', 'products'],
    queryFn: async () => (await api.get('/farm/byproducts')).data.byproducts as Byproduct[],
  });
  const units = useQuery({
    queryKey: ['byproducts', 'units'],
    queryFn: async () => (await api.get('/farm/byproducts/units')).data.units as ByproductUnit[],
  });

  return {
    products: products.data ?? [],
    active: (products.data ?? []).filter(p => p.is_active),
    units: units.data ?? [],
    isLoading: products.isLoading,
  };
}

/** "12.5 kg" — quantity with the unit's short name. */
export const qtyLabel = (qty: string | number | null | undefined, unit?: string | null) =>
  `${fmtNum(qty)}${unit ? ` ${unit}` : ''}`;
