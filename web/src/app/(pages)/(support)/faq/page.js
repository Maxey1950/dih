export default function FAQ() {
  return (
      <div className="container-fluid py-5" style={{ backgroundImage: 'url(/images/196851.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', minHeight: '100vh' }}>
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="card bg-body-tertiary border-0 shadow-sm">
              <div className="card-body p-4 p-md-5">
                <h1 className="text-center mb-4">Frequently Asked Questions</h1>
                <p className="text-muted text-center mb-5">Find answers to commonly asked questions about our services</p>
  
                <div className="mb-4">
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-primary text-white rounded-top">
                      <h2 className="h5 mb-0">Who are we?</h2>
                    </div>
                    <div className="card-body">
                      <p className="text-body-secondary">Welcome to AlphaBlox! We aim to be the best and most reliable asset hosting service out there. We currently offer forum posting and connections. We also plan to offer a file hosting service soon.</p>
                      <p className="text-body-secondary">In general, these are the limitations we impose on our users:</p>
                      <ul className="text-body-secondary">
                        <li>You can curse (use profanity), as long as it's not a slur.</li>
                        <li>Only users that are 13 years of age or older are allowed.</li>
                        <li>We do not allow users to post or share any content that is illegal, harmful, or offensive.</li>
                        <li>We reserve the right to remove any content that violates our terms of service.</li>
                        <li>Our platform has content filtering and moderation tools to ensure a safe and enjoyable experience for all users.</li>
                      </ul>
                      <p className="text-body-secondary">Please note that we cannot be held responsible for any content that is posted on our platform. Users are responsible for their own actions and the content they share. We take down any inappropriate content immediately.</p>
                      <p className="text-body-secondary">If you have any questions or concerns, please don't hesitate to <a href="/contact">contact our support team</a>.</p>
                    </div>
                  </div>

          
                </div>
  <div className="mb-4">
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-primary text-white rounded-top">
                      <h2 className="h5 mb-0">add more later</h2>
                    </div>
                    <div className="card-body">
                      <p className="text-body-secondary">later</p>
                    </div>
                  </div>

          
                </div>
                <div className="border-top pt-4 mt-5">
                  <p className="text-muted text-center">
                    Didn't find what you're looking for? <a href="/contact" className="text-decoration-none">Contact our support team</a>
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