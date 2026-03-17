/**
 * Zod schemas for runtime validation of API responses.
 *
 * All schemas use `safeParse` or `parse` in the consuming modules. Invalid responses
 * throw clear errors instead of propagating undefined values. Use `z.looseObject` for
 * iTunes/RSS responses to allow extra fields; use `z.object` for strict shapes.
 */
import { z } from 'zod';

/**
 * iTunes API app response schema.
 *
 * Validates a single app object from the iTunes Lookup API or Search API.
 * Used by `app()`, `search()`, `list()` (fullDetail), `developer()`, `similar()`.
 * `fileSizeBytes` accepts string or number per Apple's API behavior.
 */
export const iTunesAppResponseSchema = z.looseObject({
  wrapperType: z.string().optional(),
  kind: z.string().optional(),
  trackId: z.number().optional(),
  bundleId: z.string().optional(),
  trackName: z.string().optional(),
  trackViewUrl: z.string().optional(),
  description: z.string().optional(),
  artworkUrl512: z.string().optional(),
  artworkUrl100: z.string().optional(),
  genres: z.array(z.string()).optional(),
  genreIds: z.array(z.coerce.number()).optional(),
  primaryGenreName: z.string().optional(),
  primaryGenreId: z.coerce.number().optional(),
  contentAdvisoryRating: z.string().optional(),
  languageCodesISO2A: z.array(z.string()).optional(),
  fileSizeBytes: z.union([z.string(), z.number()]).optional(),
  minimumOsVersion: z.string().optional(),
  releaseDate: z.string().optional(),
  currentVersionReleaseDate: z.string().optional(),
  releaseNotes: z.string().optional(),
  version: z.string().optional(),
  price: z.number().optional(),
  currency: z.string().optional(),
  artistId: z.number().optional(),
  artistName: z.string().optional(),
  artistViewUrl: z.string().optional(),
  sellerUrl: z.string().optional(),
  averageUserRating: z.number().optional(),
  userRatingCount: z.number().optional(),
  averageUserRatingForCurrentVersion: z.number().optional(),
  userRatingCountForCurrentVersion: z.number().optional(),
  screenshotUrls: z.array(z.string()).optional(),
  ipadScreenshotUrls: z.array(z.string()).optional(),
  appletvScreenshotUrls: z.array(z.string()).optional(),
  supportedDevices: z.array(z.string()).optional(),
});

export type ITunesAppResponse = z.infer<typeof iTunesAppResponseSchema>;

/**
 * iTunes Lookup API response schema.
 *
 * Full response shape from `https://itunes.apple.com/lookup?id=...`.
 * Contains `resultCount` and `results` array of app objects.
 */
export const iTunesLookupResponseSchema = z.object({
  resultCount: z.number(),
  results: z.array(iTunesAppResponseSchema),
});

export type ITunesLookupResponse = z.infer<typeof iTunesLookupResponseSchema>;

/**
 * RSS feed entry schema for App Store list feeds.
 *
 * Minimal structure for validation; used by `list()` when fullDetail is false.
 * Full entries include im:name, im:image, link, im:price, summary, im:artist,
 * category, im:releaseDate. Parsed in list.ts. `im:image` and `link` accept
 * single object or array (Apple varies response format).
 */
export const rssFeedEntrySchema = z.looseObject({
  id: z
    .object({
      attributes: z
        .object({
          'im:id': z.string().optional(),
          'im:bundleId': z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  'im:name': z.object({ label: z.string().optional() }).optional(),
  'im:image': z
    .union([
      z.object({ label: z.string().optional() }),
      z.array(z.object({ label: z.string().optional() })),
    ])
    .optional(),
  link: z
    .union([
      z.object({
        attributes: z
          .object({ href: z.string().optional(), rel: z.string().optional() })
          .optional(),
      }),
      z.array(
        z.object({
          attributes: z
            .object({ href: z.string().optional(), rel: z.string().optional() })
            .optional(),
        })
      ),
    ])
    .optional(),
  'im:price': z
    .object({
      attributes: z
        .object({
          amount: z.union([z.string(), z.number()]).optional(),
          currency: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  summary: z.object({ label: z.string().optional() }).optional(),
  'im:artist': z
    .object({
      label: z.string().optional(),
      attributes: z.object({ href: z.string().optional() }).optional(),
    })
    .optional(),
  category: z
    .object({
      attributes: z
        .object({
          label: z.string().optional(),
          'im:id': z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  'im:releaseDate': z.object({ label: z.string().optional() }).optional(),
});

export type RssFeedEntry = z.infer<typeof rssFeedEntrySchema>;

/**
 * RSS feed wrapper schema for App Store list feeds.
 *
 * Top-level structure for list/chart RSS feeds (e.g. top free, top paid).
 * Used by `list()`. `entry` may be a single object or array depending on
 * Apple's response format. For reviews, use `reviewsFeedSchema`.
 */
export const rssFeedSchema = z.object({
  feed: z
    .object({
      entry: z.union([rssFeedEntrySchema, z.array(rssFeedEntrySchema)]).optional(),
    })
    .optional(),
});

export type RssFeed = z.infer<typeof rssFeedSchema>;

/**
 * Review entry schema for the reviews RSS feed.
 *
 * Validates a single review from `https://itunes.apple.com/.../rss/customerreviews/id=.../page=`.
 * Used by `reviews()`. Nested structure: author, im:version, im:rating, title, content, etc.
 */
export const reviewEntrySchema = z.object({
  author: z
    .object({
      uri: z
        .object({
          label: z.string().optional(),
        })
        .optional(),
      name: z
        .object({
          label: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  'im:version': z
    .object({
      label: z.string().optional(),
    })
    .optional(),
  'im:rating': z
    .object({
      label: z.string().optional(),
    })
    .optional(),
  title: z
    .object({
      label: z.string().optional(),
    })
    .optional(),
  content: z
    .object({
      label: z.string().optional(),
    })
    .optional(),
  id: z
    .object({
      label: z.string().optional(),
    })
    .optional(),
  updated: z
    .object({
      label: z.string().optional(),
    })
    .optional(),
});

/**
 * Reviews RSS feed wrapper schema.
 *
 * Top-level structure for the customer reviews feed. `entry` may be a single
 * review object or array.
 */
export const reviewsFeedSchema = z.object({
  feed: z
    .object({
      entry: z.union([reviewEntrySchema, z.array(reviewEntrySchema)]).optional(),
    })
    .optional(),
});

export type ReviewEntry = z.infer<typeof reviewEntrySchema>;
export type ReviewsFeed = z.infer<typeof reviewsFeedSchema>;

/**
 * Suggestion response schema.
 *
 * Validates the plist response from Apple's suggest endpoint.
 * Apple returns `plist.dict` with `title` and `hints` (array of strings).
 * `dict.array` may be a single object or array depending on response format.
 * Used by `suggest()`.
 */
export const suggestResponseSchema = z.object({
  plist: z
    .object({
      dict: z
        .object({
          array: z
            .union([
              z.string(),
              z.object({
                string: z.union([z.string(), z.array(z.string())]).optional(),
              }),
            ])
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export type SuggestResponse = z.infer<typeof suggestResponseSchema>;
