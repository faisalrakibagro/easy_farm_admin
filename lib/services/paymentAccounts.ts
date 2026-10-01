import type { AccountingPaymentAccount } from '@/types';
import { createCrudService } from './base';

/**
 * `GET /accounting/payment-accounts` is NOT paginated — it returns every
 * active account as `{ payment_accounts: AccountingPaymentAccount[] }` for
 * dropdown use across the app. `/trash` (paginated) still uses the default
 * `PaginatedResponse<T>` shape, so only the `list` response type is overridden.
 */
export const paymentAccountsApi = createCrudService<
  AccountingPaymentAccount,
  { payment_accounts: AccountingPaymentAccount[] }
>('/accounting/payment-accounts');
