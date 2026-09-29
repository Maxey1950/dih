import Link from 'next/link';
import { siteConfig } from '../../config/site';

const SOCIAL_ICONS = { twitter: 'bi-twitter-x', discord: 'bi-discord', youtube: 'bi-youtube', github: 'bi-github' };

export default function Footer() {
  return (
    <footer className="py-5 mt-auto">
      <div className="container">
        <div className="row g-4">
          {/* Company Info */}
          <div className="col-lg-8 col-md-6">
            <h5 className="mb-3">{siteConfig.name}</h5>
            <p className="text-body-secondary">
              A next-generation social platform where gamers connect, create, and compete.
            </p>
            <div className="social-links mt-3">
              {Object.entries(siteConfig.social)
                .filter(([, href]) => href)
                .map(([name, href]) => (
                  <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="me-3" aria-label={name}>
                    <i className={`bi ${SOCIAL_ICONS[name]} fs-5`}></i>
                  </a>
                ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="col-lg-2 col-md-6">
            <h6 className="mb-3">Quick Links</h6>
            <ul className="list-unstyled">
              <li className="mb-2">
                <Link href="/games" className="text-body-secondary text-decoration-none">Games</Link>
              </li>
              <li className="mb-2">
                <Link href="/catalog" className="text-body-secondary text-decoration-none">Catalog</Link>
              </li>
              <li className="mb-2">
                <Link href="/forum/home" className="text-body-secondary text-decoration-none">Forum</Link>
              </li>
              <li className="mb-2">
                <Link href="/users" className="text-body-secondary text-decoration-none">Users</Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="col-lg-2 col-md-6">
            <h6 className="mb-3">Support</h6>
            <ul className="list-unstyled">
              <li className="mb-2">
                <Link href="/faq" className="text-body-secondary text-decoration-none">FAQ</Link>
              </li>
              <li className="mb-2">
                <Link href="/safety" className="text-body-secondary text-decoration-none">Safety</Link>
              </li>
              <li className="mb-2">
                <Link href="/terms" className="text-body-secondary text-decoration-none">Terms</Link>
              </li>
              <li className="mb-2">
                <Link href="/privacy" className="text-body-secondary text-decoration-none">Privacy</Link>
              </li>
            </ul>
          </div>
        </div>

        <hr className="my-4 border-secondary" />

        {/* Bottom Footer */}
        <div className="row align-items-center">
          <div className="col-md-6 text-center text-md-start">
            <p className="text-body-secondary mb-md-0">
              © {new Date().getFullYear()} {siteConfig.name}. {siteConfig.name} is a not-for-profit private community. {siteConfig.name} is not associated with, does not deal with, or otherwise part of Roblox Corporation.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}