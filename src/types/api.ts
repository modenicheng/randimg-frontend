/** Canonical author from any API endpoint */
export interface Author {
  id?: number;
  name?: string;
  platform?: string;
  platform_id?: number | string;
  homepage?: string;
}

/** Tag attached to an image (from image detail) */
export interface ImageTag {
  id?: number;
  name: string;
  translated_name?: string;
}

/** Tag catalog entry (from /tags endpoint) */
export interface TagCatalogEntry {
  name: string;
  search_string: string;
  translated_name: string;
}
