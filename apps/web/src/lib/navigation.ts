/**
 * Primary navigation. Items whose module has not shipped are rendered as disabled entries with a
 * "Soon" label — never as links or buttons that do nothing.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Delivery phase; items are enabled only when `available` is true. */
  phase: number;
  available: boolean;
}

export type IconName = 'home' | 'discover' | 'search' | 'library' | 'create' | 'community' | 'artist' | 'market';

export const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', href: '/', icon: 'home', phase: 1, available: true },
  { label: 'Discover', href: '/discover', icon: 'discover', phase: 2, available: false },
  { label: 'Search', href: '/search', icon: 'search', phase: 2, available: false },
  { label: 'Library', href: '/library', icon: 'library', phase: 2, available: false },
  { label: 'Create', href: '/create', icon: 'create', phase: 4, available: false },
  { label: 'Community', href: '/community', icon: 'community', phase: 3, available: false },
  { label: 'Artist Centre', href: '/artist-centre', icon: 'artist', phase: 3, available: false },
  { label: 'Marketplace', href: '/marketplace', icon: 'market', phase: 5, available: false },
];
