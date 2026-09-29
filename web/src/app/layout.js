import { Poppins, Source_Sans_3 } from 'next/font/google';
import '../styles/theme.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Font Awesome (bundled locally, no CDN)
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@fortawesome/fontawesome-free/css/regular.min.css';
import '@fortawesome/fontawesome-free/css/brands.min.css';
import { BootstrapProvider } from './providers';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import './globals.css';
import Navbar from '../sections/Navbar';
import Alert from '../components/Alerts/SiteAlert';
import Footer from '../sections/Footer';
import { generateMetadata } from '../../config/metadata';
import { Toaster } from 'react-hot-toast';

const poppins = Poppins({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

// Cosmo's font (Source Sans Pro, published by Google as "Source Sans 3"),
// downloaded at build time and served from this site.
const sourceSans = Source_Sans_3({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-sans',
});

export const metadata = generateMetadata({});

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} ${sourceSans.variable}`} style={{ position: 'relative' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <BootstrapProvider>
            <AuthProvider>
              <ThemeProvider>
                <Navbar />
                <Alert />
                <main style={{ position: 'relative' }}>{children}</main>
                <Footer />
                <Toaster position="top-right" />
              </ThemeProvider>
            </AuthProvider>
          </BootstrapProvider>
        </div>
      </body>
    </html>
  );
}
