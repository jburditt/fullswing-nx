import type { ContentKind, ContentEntrySummary } from '../domain/content-entry.js';

export interface ContentFilters {
  kind?: ContentKind;
  title?: string;
  author?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedEntries {
  entries: ContentEntrySummary[];
  page: number;
  pageSize: number;
  total: number;
}

function normalized(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLocaleLowerCase('en-US') : undefined;
}

export function filterContentEntries(
  entries: readonly ContentEntrySummary[],
  filters: ContentFilters,
): ContentEntrySummary[] {
  const title = normalized(filters.title);
  const author = normalized(filters.author);
  const category = normalized(filters.category);

  return entries.filter(entry => {
    const metadata = entry.metadata;
    if (filters.kind && entry.kind !== filters.kind) {
      return false;
    }
    if (title && !metadata.title.toLocaleLowerCase('en-US').includes(title)) {
      return false;
    }
    if (author && metadata.author.toLocaleLowerCase('en-US') !== author) {
      return false;
    }
    if (category && !metadata.categories.some(value => value.toLocaleLowerCase('en-US') === category)) {
      return false;
    }
    if (filters.dateFrom && metadata.date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && metadata.date > filters.dateTo) {
      return false;
    }
    return true;
  });
}

export function paginateEntries(
  entries: readonly ContentEntrySummary[],
  options: PaginationOptions,
): PaginatedEntries {
  if (!Number.isInteger(options.page) || options.page < 1) {
    throw new RangeError('Page must be a positive integer.');
  }
  if (!Number.isInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 100) {
    throw new RangeError('Page size must be an integer between 1 and 100.');
  }

  const start = (options.page - 1) * options.pageSize;
  return {
    entries: entries.slice(start, start + options.pageSize),
    page: options.page,
    pageSize: options.pageSize,
    total: entries.length,
  };
}