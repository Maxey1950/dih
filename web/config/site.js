/**
 * Site-wide branding and links. Change these instead of editing components.
 * Social links are intentionally empty: the donor's Discord/YouTube/Twitter
 * accounts were removed. Components hide any link left empty.
 */
export const siteConfig = {
  name: 'AlphaBlox',
  description: 'A 2016-style community for building and playing games',
  // Public origin of the website, e.g. https://example.com (used for metadata only).
  url: process.env.SITE_URL || '',
  ogImage: '/images/ValkLogo.png',
  social: {
    discord: '',
    youtube: '',
    twitter: '',
    github: '',
  },
};

export const DEFAULT_AVATAR = '/images/baconhair.png';
