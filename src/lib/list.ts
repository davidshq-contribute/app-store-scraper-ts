import type { App, ListApp } from '../types/app.js';
import type { ListOptions } from '../types/options.js';
import { collection as collectionConstants } from '../types/constants.js';
import { doRequest, lookup, ensureArray, parseJson } from './common.js';
import { rssFeedSchema, type RssFeedEntry } from './schemas.js';

/** Shape of list feed entry fields we parse (RSS JSON from iTunes). */
interface ListFeedEntryShape {
  id?: { attributes?: { 'im:id'?: string; 'im:bundleId'?: string } };
  link?: { attributes?: { rel?: string; href?: string } } | Array<{ attributes?: { rel?: string; href?: string } }>;
  'im:price'?: { attributes?: { amount?: string | number; currency?: string } };
  'im:image'?: Array<{ label?: string }>;
  'im:artist'?: { label?: string; attributes?: { href?: string } };
  'im:name'?: { label?: string };
  summary?: { label?: string };
  category?: { attributes?: { label?: string; 'im:id'?: string } };
  'im:releaseDate'?: { label?: string };
}

/** Parses the app URL from a list feed entry (link with rel="alternate"). */
function parseEntryLink(entry: ListFeedEntryShape): string {
  const link = entry.link;
  if (!link) return '';
  const links = Array.isArray(link) ? link : [link];
  const alternate = links.find((l) => l.attributes?.rel === 'alternate');
  return alternate?.attributes?.href ?? '';
}

/** Parses developer ID from artist href (e.g. .../id123?... -> "123"). */
function parseDeveloperIdFromHref(href: string | undefined): string {
  if (!href?.includes('/id')) return '';
  const part = href.split('/id')[1];
  const segment = part?.split('?')[0]?.split('/')[0];
  return segment ?? '';
}

/**
 * Maps a validated RSS list feed entry to the light ListApp shape.
 * Used when fullDetail is false to avoid lookup requests.
 */
function rssEntryToListApp(entry: RssFeedEntry): ListApp | null {
  const e = entry as unknown as ListFeedEntryShape;
  const idStr = e.id?.attributes?.['im:id'];
  if (!idStr) return null;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) return null;

  const imPrice = e['im:price'];
  const amount = imPrice?.attributes?.amount;
  const price = typeof amount === 'number' ? amount : parseFloat(String(amount ?? 0));
  const currency = imPrice?.attributes?.currency ?? 'USD';

  const imImage = e['im:image'];
  const lastImage = Array.isArray(imImage) && imImage.length > 0 ? imImage[imImage.length - 1] : undefined;
  const icon = lastImage?.label ?? '';

  const imArtist = e['im:artist'];
  const artistHref = imArtist?.attributes?.href;

  return {
    id,
    appId: e.id?.attributes?.['im:bundleId'] ?? '',
    title: e['im:name']?.label ?? '',
    icon,
    url: parseEntryLink(e),
    price,
    currency,
    free: price === 0,
    description: e.summary?.label ?? '',
    developer: imArtist?.label ?? '',
    developerUrl: artistHref ?? '',
    developerId: parseDeveloperIdFromHref(artistHref),
    genre: e.category?.attributes?.label ?? '',
    genreId: e.category?.attributes?.['im:id'] ?? '',
    released: e['im:releaseDate']?.label ?? '',
  };
}

/**
 * Retrieves a list of apps from iTunes collections.
 *
 * When `fullDetail: false` (default), returns a light shape ({@link ListApp}) built only from the RSS
 * feed—no extra lookup requests. When `fullDetail: true`, fetches full details via the lookup API
 * and returns {@link App[]}.
 *
 * @param options - Options for filtering and pagination
 * @returns Promise resolving to {@link ListApp[]} when `fullDetail` is false, or {@link App[]} when true
 *
 * @example
 * ```typescript
 * // Get top 50 free iOS apps (light shape, one RSS request)
 * const apps = await list({ collection: collection.TOP_FREE_IOS });
 *
 * // Get full details for each app (RSS + lookup)
 * const apps = await list({
 *   collection: collection.TOP_FREE_IOS,
 *   num: 10,
 *   fullDetail: true
 * });
 * ```
 */
export async function list(options: ListOptions = {}): Promise<ListApp[] | App[]> {
  const {
    collection = collectionConstants.TOP_FREE_IOS,
    category,
    num = 50,
    country = 'us',
    lang,
    fullDetail = false,
    requestOptions,
  } = options;

  const limit = Math.min(num, 200);

  let url = `https://itunes.apple.com/${country}/rss/${collection}`;
  if (category) {
    url += `/genre=${category}`;
  }
  url += `/limit=${limit}/json`;

  const body = await doRequest(url, requestOptions);
  const parsedData = parseJson(body);
  const validationResult = rssFeedSchema.safeParse(parsedData);

  if (!validationResult.success) {
    throw new Error(
      `List API response validation failed: ${validationResult.error.message}`
    );
  }

  const data = validationResult.data;
  const entries = ensureArray(data.feed?.entry);

  if (entries.length === 0) {
    return [];
  }

  if (!fullDetail) {
    const result: ListApp[] = [];
    for (const entry of entries) {
      const app = rssEntryToListApp(entry);
      if (app) result.push(app);
    }
    return result;
  }

  const ids = entries
    .map((entry: RssFeedEntry) => {
      const idStr = entry.id?.attributes?.['im:id'];
      if (!idStr) return null;
      const n = parseInt(idStr, 10);
      return Number.isNaN(n) ? null : n;
    })
    .filter((id): id is number => id !== null);

  if (ids.length === 0) {
    return [];
  }

  return lookup(ids, 'id', country, lang, requestOptions);
}
