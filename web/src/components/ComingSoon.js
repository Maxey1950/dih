import Link from 'next/link';

/**
 * 2016-style placeholder for sections that are linked from the navbar but
 * not built yet. Uses the same card/header styling as the rest of the site.
 */
export default function ComingSoon({ title, icon = 'bi-hourglass-split', description, children }) {
  return (
    <div className="container-fluid py-5 bg-body-tertiary min-vh-100">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white">
                <h5 className="mb-0">{title}</h5>
              </div>
              <div className="card-body text-center py-5">
                <i className={`bi ${icon} text-primary d-block mb-3`} style={{ fontSize: '3rem' }}></i>
                <h4 className="fw-bold mb-2">Coming Soon</h4>
                <p className="text-body-secondary mb-4">
                  {description || `${title} is not available yet. Check back after the next update.`}
                </p>
                {children}
                <Link href="/home" className="btn btn-outline-primary">
                  <i className="bi bi-arrow-left me-2"></i>Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
