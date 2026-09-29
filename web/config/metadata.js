import { siteConfig } from './site';

export function generateMetadata({
  title,
  description,
  path = '',
  noIndex = false
}) {
  const metaDescription = description || siteConfig.description;
  const url = siteConfig.url ? `${siteConfig.url}${path}` : undefined;

  return {
    ...(siteConfig.url ? { metadataBase: new URL(siteConfig.url) } : {}),
    title: title ? `${title} | ${siteConfig.name}` : siteConfig.name,
    description: metaDescription,
    keywords: ['gaming', 'social platform', 'community'],
    authors: [{ name: `${siteConfig.name} Team` }],
    openGraph: {
      title: title || siteConfig.name,
      description: metaDescription,
      url,
      siteName: siteConfig.name,
      images: [{ url: siteConfig.ogImage }],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: title || siteConfig.name,
      description: metaDescription,
      images: [siteConfig.ogImage],
    },
    robots: {
      index: !noIndex,
      follow: true,
    },
    icons: {
      icon: [
        { url: '/favicon.ico' },
        { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
        { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      ],
      shortcut: '/favicon.ico',
      apple: '/favicon.ico',
    },
  };
}