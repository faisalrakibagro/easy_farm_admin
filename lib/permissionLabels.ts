/** Any i18next `t` (or a component's `t` prop). */
type Translate = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Human names for permission and role identifiers, in the current language.
 * 'farm.cattle.view' → "Cattle · View", 'dashboard-sections.top-cattle' → the
 * dashboard section's own title. Unknown pieces fall back to the raw text.
 */
export function permissionLabel(name: string, t: Translate): string {
  const parts = name.split('.');
  if (parts[0] === 'dashboard-sections') {
    const key = parts.slice(1).join('.').replace(/-/g, '_');
    return t(`section.${key}`, { ns: 'dashboard', defaultValue: parts.slice(1).join('.') });
  }
  const action = parts[parts.length - 1];
  const resource = parts.length > 2 ? parts.slice(1, -1).join('.') : parts[0];
  const res = t(`roles.perm_resource.${resource}`, { ns: 'users', defaultValue: resource });
  const act = t(`roles.perm_action.${action}`, { ns: 'users', defaultValue: action });
  return `${res} · ${act}`;
}

/** The seeded role names are translated; a role someone created keeps its own name. */
export function roleLabel(name: string, t: Translate): string {
  return t(`roles.names.${name}`, { ns: 'users', defaultValue: name });
}
