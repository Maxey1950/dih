import { FaShieldAlt, FaLock, FaUserShield, FaExclamationTriangle, FaCheckCircle, FaBullhorn } from 'react-icons/fa';

export default function Safety() {
  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-5">
                <div className="display-5 mb-3 d-flex align-items-center justify-content-center">
                  <FaShieldAlt className="text-primary me-3" />
                  <h1 className="mb-0">Safety Center</h1>
                </div>
                <div className="row justify-content-center">
                  <div className="col-lg-8">
                    <p className="text-body-secondary lead">Your safety is our top priority. Learn about our safety features and guidelines to ensure a secure experience.</p>
                  </div>
                </div>
              </div>

              {/* Key Safety Features */}
              <section className="mb-5">
                <div className="d-flex align-items-center mb-4">
                  <div className="badge bg-primary-subtle text-primary px-3 py-2 me-3">
                    <FaLock />
                  </div>
                  <h2 className="h3 mb-0">Key Safety Features</h2>
                </div>
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="card h-100 border-0 bg-body">
                      <div className="card-body">
                        <h3 className="h5 text-primary mb-3">Account Security</h3>
                        <ul className="list-unstyled mb-0">
                          <li className="mb-3 d-flex">
                            <FaCheckCircle className="text-success mt-1 me-2" />
                            <span className="text-body-secondary">Two-factor authentication (2FA)</span>
                          </li>
                          <li className="mb-3 d-flex">
                            <FaCheckCircle className="text-success mt-1 me-2" />
                            <span className="text-body-secondary">Regular security audits</span>
                          </li>
                          <li className="mb-3 d-flex">
                            <FaCheckCircle className="text-success mt-1 me-2" />
                            <span className="text-body-secondary">Secure password requirements</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card h-100 border-0 bg-body">
                      <div className="card-body">
                        <h3 className="h5 text-primary mb-3">Data Protection</h3>
                        <ul className="list-unstyled mb-0">
                          <li className="mb-3 d-flex">
                            <FaCheckCircle className="text-success mt-1 me-2" />
                            <span className="text-body-secondary">End-to-end encryption</span>
                          </li>
                          <li className="mb-3 d-flex">
                            <FaCheckCircle className="text-success mt-1 me-2" />
                            <span className="text-body-secondary">Secure data storage</span>
                          </li>
                          <li className="mb-3 d-flex">
                            <FaCheckCircle className="text-success mt-1 me-2" />
                            <span className="text-body-secondary">Regular backups</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Safety Guidelines */}
              <section className="mb-5">
                <div className="d-flex align-items-center mb-4">
                  <div className="badge bg-success-subtle text-success px-3 py-2 me-3">
                    <FaUserShield />
                  </div>
                  <h2 className="h3 mb-0">Safety Guidelines</h2>
                </div>
                <div className="alert alert-info bg-info-subtle border-0 mb-4">
                  <div className="d-flex">
                    <FaBullhorn className="text-info mt-1 me-2" />
                    <p className="mb-0">Follow these guidelines to maintain a safe environment for everyone.</p>
                  </div>
                </div>
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="card border-0 bg-body h-100">
                      <div className="card-body">
                        <h3 className="h5 text-primary mb-3">Do's</h3>
                        <ul className="text-body-secondary mb-0">
                          <li className="mb-2">Use strong, unique passwords</li>
                          <li className="mb-2">Enable two-factor authentication</li>
                          <li className="mb-2">Keep your software updated</li>
                          <li className="mb-2">Report suspicious activities</li>
                          <li>Regularly review account activity</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card border-0 bg-body h-100">
                      <div className="card-body">
                        <h3 className="h5 text-danger mb-3">Don'ts</h3>
                        <ul className="text-body-secondary mb-0">
                          <li className="mb-2">Share account credentials</li>
                          <li className="mb-2">Click suspicious links</li>
                          <li className="mb-2">Download unauthorized files</li>
                          <li className="mb-2">Share personal information</li>
                          <li>Use public Wi-Fi without VPN</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Reporting Issues */}
              <section className="mb-5">
                <div className="d-flex align-items-center mb-4">
                  <div className="badge bg-warning-subtle text-warning px-3 py-2 me-3">
                    <FaExclamationTriangle />
                  </div>
                  <h2 className="h3 mb-0">Reporting Issues</h2>
                </div>
                <div className="card border-0 bg-body">
                  <div className="card-body">
                    <div className="row g-4">
                      <div className="col-md-7">
                        <h3 className="h5 text-primary mb-3">How to Report</h3>
                        <p className="text-body-secondary mb-4">
                          If you notice any suspicious activity or security concerns, please report them immediately:
                        </p>
                        <ul className="text-body-secondary mb-4">
                          <li className="mb-2">Use the in-app reporting feature</li>
                          <li className="mb-2">Contact our security team</li>
                          <li>Email us at security@yourcompany.com</li>
                        </ul>
                      </div>
                      <div className="col-md-5">
                        <div className="d-grid gap-2">
                          <a href="/contact" className="btn btn-primary">
                            Contact Security Team
                          </a>
                          <a href="/report" className="btn btn-outline-primary">
                            Submit Report
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Additional Resources */}
              <section className="mb-5">
                <div className="d-flex align-items-center mb-4">
                  <div className="badge bg-info-subtle text-info px-3 py-2 me-3">
                    <i className="fas fa-book"></i>
                  </div>
                  <h2 className="h3 mb-0">Additional Resources</h2>
                </div>
                <div className="row g-4">
                  <div className="col-md-4">
                    <div className="card h-100 border-0 bg-body text-center">
                      <div className="card-body">
                        <h3 className="h5 text-primary mb-3">Safety Blog</h3>
                        <p className="text-body-secondary mb-3">Read our latest safety tips and updates</p>
                        <a href="/blog/safety" className="btn btn-outline-primary btn-sm">Read More</a>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card h-100 border-0 bg-body text-center">
                      <div className="card-body">
                        <h3 className="h5 text-primary mb-3">Help Center</h3>
                        <p className="text-body-secondary mb-3">Find answers to common safety questions</p>
                        <a href="/help" className="btn btn-outline-primary btn-sm">Visit Help Center</a>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="card h-100 border-0 bg-body text-center">
                      <div className="card-body">
                        <h3 className="h5 text-primary mb-3">Community Guidelines</h3>
                        <p className="text-body-secondary mb-3">Learn about our community standards</p>
                        <a href="/guidelines" className="btn btn-outline-primary btn-sm">View Guidelines</a>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="border-top pt-4 mt-5">
                <p className="text-muted text-center small">
                  Our safety measures and guidelines are regularly updated to ensure the best protection for our users.
                  Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    );
}