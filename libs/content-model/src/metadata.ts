import { readFile } from 'node:fs/promises';
import { ParsedMetadata } from './types.js';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertString(value: unknown, fieldName: string, filePath: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Metadata file ${filePath} must contain a non-empty string "${fieldName}" field.`);
  }

  return value;
}

function assertCategories(value: unknown, filePath: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Metadata file ${filePath} must contain a "categories" array.`);
  }

  if (value.length === 0) {
    throw new Error(`Metadata file ${filePath} must contain at least one category.`);
  }

  const categories = value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new Error(`Metadata file ${filePath} has an invalid categories[${index}] value.`);
    }

    return entry;
  });

  return categories;
}

function parseDate(value: string, filePath: string): Date {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(
      `Metadata file ${filePath} has an invalid date "${value}". Use ISO date format YYYY-MM-DD.`
    );
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Metadata file ${filePath} has an invalid calendar date "${value}".`);
  }

  return parsed;
}

export async function loadMetadata(
  filePath: string,
  expectedRoute: string,
): Promise<ParsedMetadata> {
  const source = await readFile(filePath, 'utf8');

  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    throw new Error(`Metadata file ${filePath} is not valid JSON: ${(error as Error).message}`);
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Metadata file ${filePath} must contain a JSON object.`);
  }

  const object = raw as Record<string, unknown>;
  const route = assertString(object.route, 'route', filePath);
  const title = assertString(object.title, 'title', filePath);
  const author = assertString(object.author, 'author', filePath);
  const date = assertString(object.date, 'date', filePath);
  const categories = assertCategories(object.categories, filePath);
  const dateValue = parseDate(date, filePath);

  if (route !== expectedRoute) {
    throw new Error(
      `Metadata file ${filePath} must use route "${expectedRoute}" to match its basename, but found "${route}".`
    );
  }

  return {
    route,
    title,
    author,
    date,
    categories,
    dateValue,
  };
}
