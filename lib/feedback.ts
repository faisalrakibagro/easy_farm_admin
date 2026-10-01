import i18n from '@/lib/i18n';

/**
 * Fallback toast text for when the API sends no message of its own (the API's
 * messages are already translated). Always in the current language.
 */
export const savedMsg = () => i18n.t('common:ui.saved_ok');
export const failedMsg = () => i18n.t('common:ui.failed_try_again');
export const trashedMsg = () => i18n.t('common:ui.moved_to_trash');
export const deletedMsg = () => i18n.t('common:ui.deleted_ok');
export const deleteFailedMsg = () => i18n.t('common:error.failed_delete');
