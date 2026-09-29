export default function PrivacyPolicy() {
    return (
      <div className="container-fluid py-5 bg-body-tertiary">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-5">
                  <h1 className="display-5 mb-3">Privacy Policy</h1>
                  <div className="row justify-content-center">
                    <div className="col-lg-8">
                      <p className="text-body-secondary lead">Last updated: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
  
                {/* Introduction */}
                <section className="mb-5">
                  <div className="d-flex align-items-center mb-4">
                    <div className="badge bg-primary-subtle text-primary px-3 py-2 me-3">
                      <i className="fas fa-shield-alt"></i>
                    </div>
                    <h2 className="h3 mb-0">Introduction</h2>
                  </div>
                  <div className="ps-lg-5">
                    <p className="text-body-secondary">
                      At [Your Company], we take your privacy seriously. This Privacy Policy explains how we collect, use, 
                      disclose, and safeguard your information when you visit our website or use our services.
                    </p>
                  </div>
                </section>
  
                {/* Information We Collect */}
                <section className="mb-5">
                  <div className="d-flex align-items-center mb-4">
                    <div className="badge bg-info-subtle text-info px-3 py-2 me-3">
                      <i className="fas fa-database"></i>
                    </div>
                    <h2 className="h3 mb-0">Information We Collect</h2>
                  </div>
                  <div className="ps-lg-5">
                    <h3 className="h5 text-primary mb-3">Personal Information</h3>
                    <p className="text-body-secondary mb-4">
                      We may collect personal information that you voluntarily provide to us when you:
                    </p>
                    <ul className="text-body-secondary mb-4">
                      <li className="mb-2">Register for an account</li>
                      <li className="mb-2">Sign up for our newsletter</li>
                      <li className="mb-2">Contact us for support</li>
                      <li className="mb-2">Use our services</li>
                    </ul>
  
                    <h3 className="h5 text-primary mb-3">Automatically Collected Information</h3>
                    <p className="text-body-secondary mb-4">
                      When you visit our website, we automatically collect certain information about your device, including:
                    </p>
                    <div className="row g-4 mb-4">
                      <div className="col-md-6">
                        <div className="card h-100 border-0 bg-body">
                          <div className="card-body">
                            <h4 className="h6 text-primary mb-3">Device Information</h4>
                            <ul className="text-body-secondary list-unstyled mb-0">
                              <li className="mb-2">• IP Address</li>
                              <li className="mb-2">• Browser type</li>
                              <li className="mb-2">• Operating system</li>
                              <li>• Device identifiers</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card h-100 border-0 bg-body">
                          <div className="card-body">
                            <h4 className="h6 text-primary mb-3">Usage Information</h4>
                            <ul className="text-body-secondary list-unstyled mb-0">
                              <li className="mb-2">• Pages visited</li>
                              <li className="mb-2">• Time spent on pages</li>
                              <li className="mb-2">• Links clicked</li>
                              <li>• Interaction data</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
  
                {/* How We Use Your Information */}
                <section className="mb-5">
                  <div className="d-flex align-items-center mb-4">
                    <div className="badge bg-success-subtle text-success px-3 py-2 me-3">
                      <i className="fas fa-cog"></i>
                    </div>
                    <h2 className="h3 mb-0">How We Use Your Information</h2>
                  </div>
                  <div className="ps-lg-5">
                    <div className="card border-0 bg-body mb-4">
                      <div className="card-body">
                        <h3 className="h5 text-primary mb-3">We use your information to:</h3>
                        <div className="row g-4">
                          <div className="col-md-6">
                            <ul className="text-body-secondary list-unstyled mb-0">
                              <li className="mb-2">✓ Provide and maintain our services</li>
                              <li className="mb-2">✓ Improve user experience</li>
                              <li className="mb-2">✓ Send important notifications</li>
                              <li>✓ Process transactions</li>
                            </ul>
                          </div>
                          <div className="col-md-6">
                            <ul className="text-body-secondary list-unstyled mb-0">
                              <li className="mb-2">✓ Analyze usage patterns</li>
                              <li className="mb-2">✓ Prevent fraud</li>
                              <li className="mb-2">✓ Respond to inquiries</li>
                              <li>✓ Comply with legal obligations</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
  
                {/* Data Security */}
                <section className="mb-5">
                  <div className="d-flex align-items-center mb-4">
                    <div className="badge bg-warning-subtle text-warning px-3 py-2 me-3">
                      <i className="fas fa-lock"></i>
                    </div>
                    <h2 className="h3 mb-0">Data Security</h2>
                  </div>
                  <div className="ps-lg-5">
                    <div className="alert alert-info bg-info-subtle border-0">
                      <p className="mb-0">
                        We implement appropriate technical and organizational security measures to protect your personal information.
                        However, no method of transmission over the Internet is 100% secure.
                      </p>
                    </div>
                  </div>
                </section>
  
                {/* Your Rights */}
                <section className="mb-5">
                  <div className="d-flex align-items-center mb-4">
                    <div className="badge bg-danger-subtle text-danger px-3 py-2 me-3">
                      <i className="fas fa-user-shield"></i>
                    </div>
                    <h2 className="h3 mb-0">Your Rights</h2>
                  </div>
                  <div className="ps-lg-5">
                    <div className="row g-4">
                      <div className="col-md-6">
                        <div className="card h-100 border-0 bg-body">
                          <div className="card-body">
                            <h3 className="h5 text-primary mb-3">You have the right to:</h3>
                            <ul className="text-body-secondary list-unstyled mb-0">
                              <li className="mb-2">• Access your personal data</li>
                              <li className="mb-2">• Correct inaccurate data</li>
                              <li className="mb-2">• Request data deletion</li>
                              <li>• Withdraw consent</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card h-100 border-0 bg-body">
                          <div className="card-body">
                            <h3 className="h5 text-primary mb-3">How to Exercise Your Rights:</h3>
                            <p className="text-body-secondary mb-3">
                              To exercise these rights, please contact us at:
                            </p>
                            <a href="/contact" className="btn btn-outline-primary btn-sm">Contact Us</a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
  
                {/* Contact Information */}
                <section className="mb-5">
                  <div className="d-flex align-items-center mb-4">
                    <div className="badge bg-primary-subtle text-primary px-3 py-2 me-3">
                      <i className="fas fa-envelope"></i>
                    </div>
                    <h2 className="h3 mb-0">Contact Information</h2>
                  </div>
                  <div className="ps-lg-5">
                    <p className="text-body-secondary">
                      If you have any questions about this Privacy Policy, please contact us:
                    </p>
                    <ul className="text-body-secondary list-unstyled">
                      <li className="mb-2">Email: privacy@yourcompany.com</li>
                      <li className="mb-2">Address: [Your Company Address]</li>
                      <li>Phone: [Your Phone Number]</li>
                    </ul>
                  </div>
                </section>
  
                <div className="border-top pt-4 mt-5">
                  <p className="text-muted text-center small">
                    This privacy policy was last updated on {new Date().toLocaleDateString()}. We reserve the right to update 
                    this policy at any time. Please check back regularly for updates.
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