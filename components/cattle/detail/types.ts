export type DetailLineItem = { key: string; medicine_id: string; qty_value: string; next_due: string };

export const newDetailLine = (): DetailLineItem => ({ key: Math.random().toString(36).slice(2), medicine_id: '', qty_value: '', next_due: '' });
