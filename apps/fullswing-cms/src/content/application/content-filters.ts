import { ValidationError, type ValidationIssue } from '../domain/content-errors.js';
import type { ContentKind } from '../domain/content-entry.js';
import type { ContentFilters, PaginationOptions } from './list-content.js';

export interface ParsedDashboardQuery {
  filters: ContentFilters;
  pagination: PaginationOptions;
}

function readString(query: Record<string, unknown>, name: string): string | undefined {
  const value = query[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ValidationError([{ field: name, message: 'Provide exactly one value.' }]);
  }
  return value.trim() || undefined;
}

function parseDateFilter(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError([{ field, message: 'Use a date in YYYY-MM-DD format.' }]);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ValidationError([{ field, message: 'Enter a real calendar date.' }]);
  }
  return value;
}

function parsePositiveInteger(
  query: Record<string, unknown>,
  name: string,
  defaultValue: number,
  maximum?: number,
): number {
  const rawValue = readString(query, name);
  if (!rawValue) {
    return defaultValue;
  }
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
    const range = maximum === undefined ? 'a positive integer' : `an integer between 1 and ${maximum}`;
    throw new ValidationError([{ field: name, message: `Enter ${range}.` }]);
  }
  return value;
}

export function parseDashboardQuery(query: Record<string, unknown>): ParsedDashboardQuery {
  const rawKind = readString(query, 'kind');
  if (rawKind && rawKind !== 'all' && rawKind !== 'blog' && rawKind !== 'page') {
    throw new ValidationError([{ field: 'kind', message: 'Select Blog, Page, or All.' }]);
  }

  const dateFrom = parseDateFilter(readString(query, 'dateFrom'), 'dateFrom');
  const dateTo = parseDateFilter(readString(query, 'dateTo'), 'dateTo');
  if (dateFrom && dateTo && dateFrom > dateTo) {
    const issues: ValidationIssue[] = [{ field: 'dateTo', message: 'The end date must not be before the start date.' }];
    throw new ValidationError(issues);
  }

  const filters: ContentFilters = {
    kind: rawKind === 'all' ? undefined : rawKind as ContentKind | undefined,
    title: readString(query, 'title'),
    author: readString(query, 'author'),
    category: readString(query, 'category'),
    dateFrom,
    dateTo,
  };

  return {
    filters,
    pagination: {
      page: parsePositiveInteger(query, 'page', 1),
      pageSize: parsePositiveInteger(query, 'pageSize', 20, 100),
    },
  };
}