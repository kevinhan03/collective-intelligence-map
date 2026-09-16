export type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};
export type ThemeMap = {
  id: string;
  slug: string;
  title: string;
  description: string;
  rules: string;
  country: string;
  city: string;
  tags: string[];
  bounds: Bounds;
  place_count: number;
  follower_count: number;
  contributor_count: number;
};
export type MapPlace = {
  id: string;
  place_id: string;
  map_id: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  rationale: string;
  status: string;
  added_by: string | null;
  handle: string;
  positive: number;
  negative: number;
  saved_count: number;
  created_at: string;
  last_verified_at: string | null;
  source_note?: string;
};
export type Comment = {
  id: string;
  map_place_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  handle: string;
};
export type Viewer = {
  id: string;
  handle: string;
  role: "member" | "contributor" | "admin";
  bio: string;
  avatar_path: string | null;
};
export type Sort = "relevance" | "newest" | "verified";
export type RendererConfig = {
  provider: "google" | "kakao" | "maplibre" | "preview";
  key: string;
  mapId?: string;
};
export type Candidate = {
  provider: "google" | "kakao" | "overture";
  externalId: string;
  label: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: string;
  locality?: string;
  countryCode?: string;
  attribution: string;
  matchType?: "exact" | "prefix" | "similar";
  token?: string;
};

/** Normalized discovery inventory; never contains Theme Map/community activity. */
export type SearchPlace = {
  source: "overture" | "kakao" | "user";
  sourceId: string;
  primaryName: string;
  alternateNames?: string[];
  countryCode: string;
  region?: string;
  locality?: string;
  address?: string;
  latitude: number;
  longitude: number;
  category?: string;
};
