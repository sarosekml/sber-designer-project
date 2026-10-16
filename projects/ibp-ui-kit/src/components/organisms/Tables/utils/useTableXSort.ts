import { useMemo } from 'react';

import { ColumnsConfig } from '../Table';

/**
 * Hook to configure column sorting based on analytics specification.
 *
 * Accepts a table columns configuration and a list of field names from the `x-sort` attribute
 * in the analytics specification, and returns an updated configuration where `sortingEnabled`
 * is set to `true` for columns whose `name` matches any field in the provided list.
 *
 * Optionally accepts a field name mapping. If provided, column `name` will be translated via this map
 * before checking against the `fields` list. If the map does not contain the column name, the original name is used.
 *
 * @template RowType - The type of a single row in the table data.
 * @param {ColumnsConfig<RowType>} columns - The original columns configuration.
 * @param {readonly string[]} fields - Array of field names from the `x-sort` analytics attribute that should support sorting.
 * @param {Record<string, string>} [fieldMap] - Optional mapping to translate column names before matching.
 * @returns {ColumnsConfig<RowType>} - New columns configuration with `sortingEnabled` flag updated for matching fields.
 *
 * @example
 * const columns = [
 *   { name: 'id', title: 'ID' },
 *   { name: 'name', title: 'Name' },
 *   { name: 'email', title: 'Email' }
 * ];
 *
 * const sortableFields = ['fullName', 'mail']; // from x-sort
 * const fieldMap = { name: 'fullName', email: 'mail' };
 * const sortedColumns = useTableXSort(columns, sortableFields, fieldMap);
 * // Now columns 'name' and 'email' will have sortingEnabled: true (mapped to 'fullName' and 'mail')
 */
export function useTableXSort<RowType>(
  columns: ColumnsConfig<RowType>,
  fields: readonly string[],
  fieldMap?: Record<string, string>,
): ColumnsConfig<RowType> {
  return useMemo(() => {
    return columns.map((c) => {
      const mappedName = fieldMap ? fieldMap[c.name] ?? c.name : c.name;

      return {
        ...c,
        sortingEnabled: fields.includes(mappedName),
      };
    });
  }, [columns, fields, fieldMap]);
}
