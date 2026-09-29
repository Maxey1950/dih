import { generateMetadata } from '../../../../../config/metadata';

export const metadata = generateMetadata({
  title: 'Terms of Service',
  description: 'Terms of Service for AlphaBlox',
  path: '/terms'
});

export default function TermsOfService() {
    return (
      <div className="container-fluid py-5 bg-body-tertiary">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4 p-md-5">
                <h1 className="text-center mb-4">Terms of Service</h1>
                <p className="text-muted mb-4">Last updated: {new Date().toLocaleDateString()}</p>
  
                <section className="mb-5">
                  <h2 className="h4 mb-3">1. Acceptance of Terms</h2>
                  <p className="text-body-secondary">By accessing and using this website, you accept and agree to be bound by the terms and provisions of this agreement.</p>
                </section>
  
                <section className="mb-5">
                  <h2 className="h4 mb-3">2. User Conduct</h2>
                  <p className="text-body-secondary">You agree to use the website in accordance with all applicable laws and regulations. You agree not to:</p>
                  <ul className="text-body-secondary">
                    <li>Use the service for any illegal purpose</li>
                    <li>Attempt to gain unauthorized access to any portion of the platform</li>
                    <li>Interfere with or disrupt the service or servers</li>
                    <li>Share inappropriate or harmful content</li>
                  </ul>
                </section>
  
                <section className="mb-5">
                  <h2 className="h4 mb-3">3. Account Security</h2>
                  <p className="text-body-secondary">You are responsible for maintaining the confidentiality of your account and password. You agree to notify us immediately of any unauthorized use of your account.</p>
                </section>
  
                <section className="mb-5">
                  <h2 className="h4 mb-3">4. Intellectual Property</h2>
                  <p className="text-body-secondary">All content, features, and functionality of this website are owned by us and are protected by international copyright, trademark, and other intellectual property laws.</p>
                </section>
  
                <section className="mb-5">
                  <h2 className="h4 mb-3">5. Limitation of Liability</h2>
                  <p className="text-body-secondary">We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.</p>
                </section>
  
                <section className="mb-5">
                  <h2 className="h4 mb-3">6. Changes to Terms</h2>
                  <p className="text-body-secondary">We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the website.</p>
                </section>
  
                <section className="mb-5">
                  <h2 className="h4 mb-3">7. Termination</h2>
                  <p className="text-body-secondary">We reserve the right to terminate or suspend access to our service immediately, without prior notice, for any reason whatsoever.</p>
                </section>
  
                <div className="border-top pt-4 mt-5">
                  <p className="text-muted small">If you have any questions about these Terms of Service, please contact us.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    );
  }