import type { CattleOrigin, CattlePurpose, CattleReproductiveStatus } from '@/types';

/** The add / edit animal form. Everything is a string while typed. */
export interface CattleFormData {
  tag_number: string; name: string; ear_tag_number: string;
  animal_type: string; animal_type_id: string;
  breed: string; breed_id: string; color: string; gender: 'male' | 'female';
  age_stage_id: string;
  age_category_id: string;
  purchase_date: string; purchase_price: string; purchase_weight: string;
  health_status: 'healthy' | 'sick' | 'critical' | 'recovering';
  feed_ratio: string; shed_id: string;
  seller_name: string; seller_phone: string; notes: string;
  payment_account_id: string;
  // Breeding foundation
  origin: CattleOrigin;
  purpose: CattlePurpose | '';
  dam_id: string; sire_id: string;
  birth_date: string; birth_weight: string; birth_value: string; current_weight: string;
  reproductive_status: CattleReproductiveStatus | '';
  /** Its own milking sessions, comma-separated; empty = its type's. */
  milking_sessions: string;
}

/** Fields only a bought animal has — never sent for a farm-born one. */
export const PURCHASE_ONLY_FIELDS: (keyof CattleFormData)[] = [
  'purchase_date', 'purchase_price', 'purchase_weight', 'payment_account_id', 'seller_name', 'seller_phone',
];

export const REPRODUCTIVE_STATUSES: CattleReproductiveStatus[] = ['open', 'inseminated', 'pregnant', 'lactating', 'dry'];

export type ParentOption = { id: number; tag_number: string; name: string | null; gender: 'male' | 'female'; animal_type_id: number | null };

export const DEFAULT_CATTLE_FORM: CattleFormData = {
  tag_number: '', name: '', ear_tag_number: '', animal_type: '', animal_type_id: '',
  breed: '', breed_id: '', color: '',
  gender: 'male', age_stage_id: '', age_category_id: '',
  purchase_date: '',
  purchase_price: '', purchase_weight: '',
  health_status: 'healthy', feed_ratio: '0',
  shed_id: '', seller_name: '', seller_phone: '', notes: '',
  payment_account_id: '',
  origin: 'purchased', purpose: '',
  dam_id: '', sire_id: '',
  birth_date: '', birth_weight: '', birth_value: '', current_weight: '',
  reproductive_status: '', milking_sessions: '',
};
