import { getCategoryDisplayName, slugify } from './categories.js';
import { BlogEntry, CategorySummary, ContentEntry, PageEntry, RepositoryView } from './types.js';

function sortEntries<T extends ContentEntry>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    const dateDifference = right.dateValue.getTime() - left.dateValue.getTime();
    if (dateDifference !== 0) {
      return dateDifference;
    }

    return left.title.localeCompare(right.title);
  });
}

export class ContentRepository implements RepositoryView {
  private readonly blogsByRoute: Map<string, BlogEntry>;
  private readonly pagesByRoute: Map<string, PageEntry>;
  private readonly blogs: BlogEntry[];
  private readonly pages: PageEntry[];
  private readonly all: ContentEntry[];
  private readonly categories: CategorySummary[];

  constructor(blogs: BlogEntry[], pages: PageEntry[]) {
    this.blogs = sortEntries(blogs);
    this.pages = sortEntries(pages);
    this.all = sortEntries([...blogs, ...pages]);
    this.blogsByRoute = new Map(this.blogs.map(blog => [blog.route, blog]));
    this.pagesByRoute = new Map(this.pages.map(page => [page.route, page]));
    this.categories = this.createCategories(this.all);
  }

  getBlog(route: string): BlogEntry | undefined {
    return this.blogsByRoute.get(route);
  }

  getPage(route: string): PageEntry | undefined {
    return this.pagesByRoute.get(route);
  }

  getBlogs(): BlogEntry[] {
    return [...this.blogs];
  }

  getPages(): PageEntry[] {
    return [...this.pages];
  }

  getAll(): ContentEntry[] {
    return [...this.all];
  }

  getCategories(): CategorySummary[] {
    return [...this.categories];
  }

  private createCategories(entries: ContentEntry[]): CategorySummary[] {
    const counts = new Map<string, number>();

    for (const entry of entries) {
      for (const category of entry.categories) {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        displayName: getCategoryDisplayName(name),
        slug: slugify(name),
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }
}