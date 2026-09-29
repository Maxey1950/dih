'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RequireAuth from '../../../../../components/auth/RequireAuth';
import { forumApi, errorMessage } from '../../../../../lib/api';

const sectionGroups = {
  AlphaBlox: {
    sections: [
      { name: 'Announcements', icon: 'bi-megaphone-fill' },
      { name: 'Change Log', icon: 'bi-newspaper' }
    ]
  },
  General: {
    sections: [
      { name: 'General Discussion', icon: 'bi-chat-dots-fill' },
      { name: 'Suggestions and Ideas', icon: 'bi-lightbulb' },
      { name: 'Off Topic', icon: 'bi-chat-dots-fill' },
      { name: 'Media', icon: 'bi-image' },
      { name: 'Asset Sharing', icon: 'bi-share-fill' },
      { name: 'Tutorials', icon: 'bi-book' },
    ]
  },
  Gaming: {
    sections: [
      { name: 'Gaming', icon: 'bi-controller' },
      { name: 'Roblox', icon: 'bi-controller' }
    ]
  },
  Other: {
    sections: [
      { name: 'Others', icon: 'bi-folder-fill' },
      { name: 'Support', icon: 'bi-question-circle' },
      { name: 'Rate My Character', icon: 'bi-star' },
      { name: 'Memes', icon: 'bi-emoji-laughing' }
    ]
  }
};

const sections = Object.values(sectionGroups)
  .flatMap(group => group.sections)
  .map(section => section.name);

function NewPost() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    section: '',
    content: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // New state for success message
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Reset error state
    setSuccess(null); // Reset success state
    setIsSubmitting(true);

    try {
      await forumApi.createThread(formData);
      setSuccess('Post created successfully!');
      setTimeout(() => {
        router.push('/forum/home');
      }, 2000);
    } catch (err) {
      setError(errorMessage(err, 'An error occurred'));
  } finally {
      setIsSubmitting(false);
  }
};

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        {/* Modern Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link href="/forum/home" className="text-decoration-none text-primary">
                <i className="bi bi-house-door me-1"></i>Forum
              </Link>
            </li>
            <li className="breadcrumb-item active fw-medium" aria-current="page">
              <i className="bi bi-plus-circle me-1"></i>New Post
            </li>
          </ol>
        </nav>

        <div className="row g-4">
          {/* Main Content Column */}
          <div className="col-lg-8">
            <div className="card shadow-sm border-0 rounded-3">
              <div className="card-header bg-primary bg-gradient text-white py-3 rounded-top-3">
                <h2 className="h4 mb-0 fw-bold">
                  <i className="bi bi-pencil-square me-2"></i>
                  Create New Topic
                </h2>
              </div>

              <div className="card-body p-4">
                {error && (
                  <div className="alert alert-danger rounded-3 d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-exclamation-circle-fill"></i>
                    {error}
                  </div>
                )}
                {success && ( // Success alert
                  <div className="alert alert-success rounded-3 d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-check-circle-fill"></i>
                    {success}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  {/* Title Input */}
                  <div className="mb-4">
                    <label className="form-label fw-medium">
                      <i className="bi bi-type-h1 me-2"></i>
                      Title
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg shadow-sm"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      maxLength={100}
                      required
                      placeholder="Enter your topic title"
                    />
                    <div className="form-text text-end">
                      {formData.title.length}/100 characters
                    </div>
                  </div>

                  {/* Section Select */}
                  <div className="mb-4">
                    <label className="form-label fw-medium">
                      <i className="bi bi-folder me-2"></i>
                      Section
                    </label>
                    <select
                      className="form-select form-select-lg shadow-sm"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      required
                    >
                      <option value="">Select a section</option>
                      {Object.entries(sectionGroups).map(([groupName, group]) => (
                        <optgroup key={groupName} label={groupName} className="fw-bold">
                          {group.sections.map((section) => (
                            <option key={section.name} value={section.name} className="fw-normal">
                              {section.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Content Textarea */}
                  <div className="mb-4">
                    <label className="form-label fw-medium">
                      <i className="bi bi-text-paragraph me-2"></i>
                      Content
                    </label>
                    <textarea
                      className="form-control form-control-lg shadow-sm"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={10}
                      maxLength={10000}
                      required
                      placeholder="Write your post content here..."
                      style={{ resize: 'vertical' }}
                    />
                    <div className="form-text text-end">
                      {formData.content.length}/10000 characters
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="d-flex gap-3">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg px-4 rounded-pill"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Creating...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send-fill me-2"></i>
                          Create Topic
                        </>
                      )}
                    </button>
                    <Link
                      href="/forum/home"
                      className="btn btn-light btn-lg px-4 rounded-pill"
                    >
                      <i className="bi bi-x-lg me-2"></i>
                      Cancel
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Guidelines Column */}
          <div className="col-lg-4">
            <div className="card shadow-sm border-0 rounded-3 sticky-top" style={{ top: '2rem' }}>
              <div className="card-body p-4">
                <h5 className="fw-bold mb-3">
                  <i className="bi bi-info-circle me-2"></i>
                  Posting Guidelines
                </h5>
                <ul className="list-unstyled mb-0">
                  <li className="mb-3 d-flex align-items-start gap-2">
                    <i className="bi bi-check-circle-fill text-success mt-1"></i>
                    <span>Keep your title clear and descriptive</span>
                  </li>
                  <li className="mb-3 d-flex align-items-start gap-2">
                    <i className="bi bi-check-circle-fill text-success mt-1"></i>
                    <span>Choose the most appropriate section for your topic</span>
                  </li>
                  <li className="mb-3 d-flex align-items-start gap-2">
                    <i className="bi bi-check-circle-fill text-success mt-1"></i>
                    <span>Provide detailed information in your post</span>
                  </li>
                  <li className="d-flex align-items-start gap-2">
                    <i className="bi bi-check-circle-fill text-success mt-1"></i>
                    <span>Be respectful and follow community guidelines</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewPostPage() {
  return (
    <RequireAuth>
      <NewPost />
    </RequireAuth>
  );
}
