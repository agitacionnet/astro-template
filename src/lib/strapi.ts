// src/lib/strapi.ts
const STRAPI_URL   = import.meta.env.STRAPI_URL   ?? 'http://localhost:1337';
const STRAPI_TOKEN = import.meta.env.STRAPI_TOKEN  ?? '';

export interface StrapiImage {
  id: number;
  url: string;
  alternativeText: string | null;
  width: number;
  height: number;
  formats?: {
    thumbnail?: { url: string; width: number; height: number };
    small?:     { url: string; width: number; height: number };
    medium?:    { url: string; width: number; height: number };
    large?:     { url: string; width: number; height: number };
  };
}

export interface StrapiMeta {
  pagination: { page: number; pageSize: number; pageCount: number; total: number };
}

export interface BlogPost {
  id: number; documentId: string; title: string; slug: string;
  excerpt: string; content: string; publishedAt: string; updatedAt: string;
  cover: StrapiImage | null; tags: string[];
  author?: { name: string; avatar: StrapiImage | null };
}

export interface Homepage {
  heroGreeting:       string | null;
  heroTitle:          string | null;
  heroSubtitle:       string | null;
  heroPrimaryLabel:   string | null;
  heroSecondaryLabel: string | null;
  heroImage:          StrapiImage | null;
  servicesLabel:         string | null;
  servicesTitle:         string | null;
  servicesDescription:   string | null;
}

// ─── Fetch base ────────────────────────────────────────────────────────────────

async function strapiRequest<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`/api${endpoint}`, STRAPI_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (STRAPI_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`Strapi error: ${res.status} — ${url.toString()}`);
  return res.json() as Promise<T>;
}

export function getStrapiImageUrl(
  image: StrapiImage | null | undefined,
  format: keyof NonNullable<StrapiImage['formats']> = 'medium'
): string {
  if (!image) return '/images/placeholder.jpg';
  const formatUrl = image.formats?.[format]?.url ?? image.url;
  return formatUrl.startsWith('http') ? formatUrl : `${STRAPI_URL}${formatUrl}`;
}

// ─── Homepage ──────────────────────────────────────────────────────────────────

export async function getHomepage(): Promise<Homepage | null> {
  try {
    const res = await strapiRequest<{ data: Homepage[] }>('/homepages', {
      'populate': 'heroImage',
    });
    return res.data?.[0] ?? null;
  } catch {
    console.warn('Homepage no disponible en Strapi, usando valores por defecto.');
    return null;
  }
}

// ─── Blog ──────────────────────────────────────────────────────────────────────

export async function getBlogPosts(page = 1, limit = 10) {
  return strapiRequest<{ data: BlogPost[]; meta: StrapiMeta }>('/blog-posts', {
    'populate':                       'cover,author.avatar,tags',
    'sort':                           'publishedAt:desc',
    'pagination[page]':               String(page),
    'pagination[pageSize]':           String(limit),
    'filters[publishedAt][$notNull]': 'true',
  });
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost> {
  const res = await strapiRequest<{ data: BlogPost[] }>('/blog-posts', {
    'filters[slug][$eq]': slug,
    'populate':           'cover,author.avatar,tags',
  });
  const post = res.data[0];
  if (!post) throw new Error(`Post not found: ${slug}`);
  return post;
}

export async function getAllBlogSlugs(): Promise<string[]> {
  const res = await strapiRequest<{ data: Pick<BlogPost, 'slug'>[] }>('/blog-posts', {
    'fields':                         'slug',
    'pagination[pageSize]':           '100',
    'filters[publishedAt][$notNull]': 'true',
  });
  return res.data.map(p => p.slug);
}

export async function getLatestBlogPosts(limit = 3): Promise<BlogPost[]> {
  const res = await getBlogPosts(1, limit);
  return res.data;
}
