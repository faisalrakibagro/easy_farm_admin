import type { Cattle } from '@/types';
import { createCrudService } from './base';

/**
 * `GET /farm/cattle` is a standard paginated list; create/update accept
 * FormData (profile image / invoice file uploads) which `api.ts`'s request
 * interceptor already handles (drops the default Content-Type so the
 * browser sets the multipart boundary).
 */
export const cattleApi = createCrudService<Cattle>('/farm/cattle');
