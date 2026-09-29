import { FaQuestionCircle, FaSearch, FaBook, FaHeadset, FaTools, FaUserCog, FaBell, FaShieldAlt, FaFileAlt } from 'react-icons/fa';

export default function Help() {
  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4 p-md-5">
                {/* Header Section */}
                <div className="text-center mb-5">
                  <div className="display-5 mb-3 d-flex align-items-center justify-content-center">
                    <FaQuestionCircle className="text-primary me-3" />
                    <h1 className="mb-0">Help Center</h1>
                  </div>
                  <div className="row justify-content-center">
                    <div className="col-lg-8">
                      <p className="text-body-secondary lead mb-4">Find answers, tutorials, and support for all your questions</p>

                      {/* Search Bar */}
                      <div className="input-group input-group-lg mb-4">
                        <span className="input-group-text bg-body border-end-0">
                          <FaSearch className="text-body-secondary" />
                        </span>
                        <input
                          type="text"
                          className="form-control bg-body border-start-0"
                          placeholder="Search for help..."
                          aria-label="Search help articles"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Popular Topics */}
                <section className="mb-5">
                  <h2 className="h3 mb-4">Popular Topics</h2>
                  <div className="row g-4">
                    <div className="col-md-4">
                      <div className="card h-100 border-0 bg-primary-subtle">
                        <div className="card-body p-4">
                          <FaUserCog className="text-primary mb-3" size={24} />
                          <h3 className="h5 mb-3">Getting Started</h3>
                          <ul className="list-unstyled mb-0">
                            <li className="mb-2">
                              <a href="#" className="text-decoration-none text-body-secondary">Account Setup</a>
                            </li>
                            <li className="mb-2">
                              <a href="#" className="text-decoration-none text-body-secondary">Basic Navigation</a>
                            </li>
                            <li>
                              <a href="#" className="text-decoration-none text-body-secondary">First Steps Guide</a>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card h-100 border-0 bg-success-subtle">
                        <div className="card-body p-4">
                          <FaBell className="text-success mb-3" size={24} />
                          <h3 className="h5 mb-3">Common Issues</h3>
                          <ul className="list-unstyled mb-0">
                            <li className="mb-2">
                              <a href="#" className="text-decoration-none text-body-secondary">Password Reset</a>
                            </li>
                            <li className="mb-2">
                              <a href="#" className="text-decoration-none text-body-secondary">Login Problems</a>
                            </li>
                            <li>
                              <a href="#" className="text-decoration-none text-body-secondary">Error Messages</a>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card h-100 border-0 bg-info-subtle">
                        <div className="card-body p-4">
                          <FaShieldAlt className="text-info mb-3" size={24} />
                          <h3 className="h5 mb-3">Security</h3>
                          <ul className="list-unstyled mb-0">
                            <li className="mb-2">
                              <a href="#" className="text-decoration-none text-body-secondary">Two-Factor Auth</a>
                            </li>
                            <li className="mb-2">
                              <a href="#" className="text-decoration-none text-body-secondary">Account Security</a>
                            </li>
                            <li>
                              <a href="#" className="text-decoration-none text-body-secondary">Privacy Settings</a>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Help Categories */}
                <section className="mb-5">
                  <h2 className="h3 mb-4">Help Categories</h2>
                  <div className="row g-4">
                    {[
                      { icon: <FaBook />, title: 'User Guides', count: '25 articles' },
                      { icon: <FaTools />, title: 'Troubleshooting', count: '30 articles' },
                      { icon: <FaFileAlt />, title: 'Documentation', count: '40 articles' },
                      { icon: <FaHeadset />, title: 'Support', count: '15 articles' }
                    ].map((category, index) => (
                      <div key={index} className="col-md-6 col-lg-3">
                        <a href="#" className="text-decoration-none">
                          <div className="card h-100 border-0 bg-body hover-shadow">
                            <div className="card-body text-center p-4">
                              <div className="text-primary mb-3">
                                {category.icon}
                              </div>
                              <h3 className="h5 mb-2">{category.title}</h3>
                              <p className="text-body-secondary small mb-0">{category.count}</p>
                            </div>
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Quick Support */}
                <section className="mb-5">
                  <h2 className="h3 mb-4">Quick Support</h2>
                  <div className="row g-4">
                    <div className="col-md-6">
                      <div className="card border-0 bg-body h-100">
                        <div className="card-body p-4">
                          <h3 className="h5 text-primary mb-3">Contact Support</h3>
                          <p className="text-body-secondary mb-4">Need personalized help? Our support team is here for you.</p>
                          <div className="d-grid gap-2">
                            <a href="/contact" className="btn btn-primary">Contact Us</a>
                            <a href="/chat" className="btn btn-outline-primary">Live Chat</a>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card border-0 bg-body h-100">
                        <div className="card-body p-4">
                          <h3 className="h5 text-primary mb-3">Community Support</h3>
                          <p className="text-body-secondary mb-4">Join our community to get help from other users.</p>
                          <div className="d-grid gap-2">
                            <a href="/community" className="btn btn-primary">Join Community</a>
                            <a href="/forum/home" className="btn btn-outline-primary">Visit Forum</a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Video Tutorials */}
                <section className="mb-5">
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <h2 className="h3 mb-0">Video Tutorials</h2>
                    <a href="/tutorials" className="btn btn-outline-primary btn-sm">View All</a>
                  </div>
                  <div className="row g-4">
                    {[1, 2, 3].map((video, index) => (
                      <div key={index} className="col-md-4">
                        <div className="card border-0 bg-body">
                          <div className="card-body p-4">
                            <div className="ratio ratio-16x9 mb-3">
                              <div className="bg-body-secondary rounded"></div>
                            </div>
                            <h3 className="h6 mb-2">Getting Started Tutorial {video}</h3>
                            <p className="text-body-secondary small mb-0">Learn the basics in under 5 minutes</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Footer CTA */}
                <div className="border-top pt-4 mt-5">
                  <div className="text-center">
                    <p className="text-body-secondary mb-3">Still need help?</p>
                    <a href="/contact" className="btn btn-primary">Contact Our Support Team</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}