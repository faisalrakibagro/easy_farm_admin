'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { invalidateKeys } from '@/lib/invalidateGroups';
import FormAlert from '@/components/ui/FormAlert';
import NumberInput from '@/components/ui/NumberInput';
import { otherErrors } from '@/lib/hooks/useFormErrors';
import { Field, FormActions, ModalShell, apiError } from '@/components/breeding/shared';

/**
 * Set a farm-born animal's internal value (plan 5.1): its opening cost and
 * the breeding income of its dam. No cash moves.
 */
export default function BirthValueModal({ cattleId, value, onClose }: { cattleId: number; value: string | null; onClose: () => void }) {
  const { t } = useTranslation('cattle');
  const qc = useQueryClient();
  const toast = useToast();
  const [opened] = useState(() => (value !== null ? String(parseFloat(value)) : ''));
  const [amount, setAmount] = useState(opened);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => api.patch(`/farm/cattle/${cattleId}/birth-value`, { birth_value: amount === '' ? null : Number(amount) }),
    onSuccess: res => {
      toast.success(res?.data?.message ?? t('breeding.birth_value_saved'));
      invalidateKeys(qc, [['cattle'], ['cattle-ledger'], ['farm-cattle'], ['profit-centers']]);
      onClose();
    },
    onError: e => { const r = apiError(e, t('breeding.birth_value_failed')); setFields(r.fields); setError(Object.keys(r.fields).length ? '' : r.message); },
  });

  return (
    <ModalShell title={t('breeding.birth_value')} onClose={onClose} dirty={amount !== opened}>
      <form onSubmit={e => { e.preventDefault(); setError(''); setFields({}); save.mutate(); }} noValidate className="p-6 space-y-4">
        <FormAlert message={error} extra={otherErrors(fields, ['birth_value'])} />
        <Field name="birth_value" label={t('breeding.birth_value')} error={fields.birth_value} hint={t('breeding.birth_value_hint')}>
          <NumberInput value={amount} prefix="৳" placeholder="0" error={fields.birth_value} data-autofocus
            onChange={v => { setAmount(v); setFields({}); }} />
        </Field>
        <FormActions onCancel={onClose} saving={save.isPending} />
      </form>
    </ModalShell>
  );
}
