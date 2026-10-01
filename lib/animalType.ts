import type { AnimalType } from '@/types';

/**
 * Read a cattle record's animal type name, whatever shape the API sent.
 *
 * `cattle.animal_type` is a plain string column, but CattleResource snake_cases
 * the eager-loaded `animalType` relation to the *same* key and merges it over
 * the attributes (a quirk it documents deliberately). So list endpoints, which
 * eager-load the relation, return `{id, name}` there, while `/farm/cattle/{id}`
 * returns the string. Rendering the object directly crashes React (error #31).
 */
export function animalTypeName(
  value: string | AnimalType | null | undefined
): string | null {
  if (value == null) return null;
  if (typeof value === 'object') return value.name ?? null;
  return value;
}
