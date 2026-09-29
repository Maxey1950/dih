'use client';



import { useState } from 'react';
import { FaEnvelope, FaDiscord, FaTwitter, FaGithub, FaMapMarkerAlt } from 'react-icons/fa';
import { siteConfig } from '../../../../../config/site';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Add your form submission logic here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated API call
      alert('Message sent successfully!');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      alert('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 p-md-5">
              <h1 className="text-center mb-4">Contact Us</h1>
              <p className="text-center text-body-secondary mb-5">Have a question or feedback? We'd love to hear from you.</p>

              <div className="row">
                {/* Contact Information */}
                <div className="col-md-4 mb-4 mb-md-0">
                  <div className="pe-md-4">
                    <h2 className="h4 mb-4">Get in Touch</h2>

                    <div className="mb-4">
                      <div className="d-flex align-items-center mb-3">
                        <FaEnvelope className="text-primary me-2" />
                        <h3 className="h6 mb-0">Email</h3>
                      </div>
                      <p className="text-body-secondary">support@yourcompany.com</p>
                    </div>

                    {siteConfig.social.discord && (
                    <div className="mb-4">
                      <div className="d-flex align-items-center mb-3">
                        <FaDiscord className="text-primary me-2" />
                        <h3 className="h6 mb-0">Discord</h3>
                      </div>
                      <p className="text-body-secondary">Join our community</p>
                      <a href={siteConfig.social.discord} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm">Join Discord</a>
                    </div>
                    )}

                    <div className="mb-4">
                      <div className="d-flex align-items-center mb-3">
                        <FaMapMarkerAlt className="text-primary me-2" />
                        <h3 className="h6 mb-0">Location</h3>
                      </div>
                      <p className="text-body-secondary">Your Company Address<br />City, Country</p>
                    </div>

                    <div className="social-links">
                      <h3 className="h6 mb-3">Follow Us</h3>
                      <div className="d-flex gap-3">
                        <a href="#" className="text-body-secondary hover-text-primary"><FaTwitter size={24} /></a>
                        <a href="#" className="text-body-secondary hover-text-primary"><FaGithub size={24} /></a>
                        <a href="#" className="text-body-secondary hover-text-primary"><FaDiscord size={24} /></a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Form */}
                <div className="col-md-8">
                  <div className="ps-md-4">
                    <h2 className="h4 mb-4">Send us a Message</h2>
                    <form onSubmit={handleSubmit}>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <div className="form-floating">
                            <input
                              type="text"
                              className="form-control bg-body-tertiary"
                              id="name"
                              name="name"
                              placeholder="Your Name"
                              value={formData.name}
                              onChange={handleChange}
                              required
                            />
                            <label htmlFor="name" className="text-body-secondary">Your Name</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-floating">
                            <input
                              type="email"
                              className="form-control bg-body-tertiary"
                              id="email"
                              name="email"
                              placeholder="Your Email"
                              value={formData.email}
                              onChange={handleChange}
                              required
                            />
                            <label htmlFor="email" className="text-body-secondary">Your Email</label>
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="form-floating">
                            <input
                              type="text"
                              className="form-control bg-body-tertiary"
                              id="subject"
                              name="subject"
                              placeholder="Subject"
                              value={formData.subject}
                              onChange={handleChange}
                              required
                            />
                            <label htmlFor="subject" className="text-body-secondary">Subject</label>
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="form-floating">
                            <textarea
                              className="form-control bg-body-tertiary"
                              id="message"
                              name="message"
                              placeholder="Your Message"
                              style={{ height: '150px' }}
                              value={formData.message}
                              onChange={handleChange}
                              required
                            ></textarea>
                            <label htmlFor="message" className="text-body-secondary">Your Message</label>
                          </div>
                        </div>
                        <div className="col-12">
                          <button 
                            type="submit" 
                            className="btn btn-primary w-100"
                            disabled={submitting}
                          >
                            {submitting ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Sending...
                              </>
                            ) : 'Send Message'}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              <div className="border-top pt-4 mt-5">
                <p className="text-muted text-center small">
                  We typically respond to inquiries within 24-48 hours during business days.
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