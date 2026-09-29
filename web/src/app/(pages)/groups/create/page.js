'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import RequireAuth from '../../../../components/auth/RequireAuth';
import { groupsApi, errorMessage } from '../../../../lib/api';

function CreateGroupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true
  });
  const [error, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    // Client-side validation
    if (formData.name.length < 3) {
      setErrors(prev => ({
        ...prev,
        name: 'Group name must be at least 3 characters'
      }));
      setLoading(false);
      return;
    }

    if (formData.description.length < 10) {
      setErrors(prev => ({
        ...prev,
        description: 'Description must be at least 10 characters'
      }));
      setLoading(false);
      return;
    }

    try {
      await groupsApi.create(formData);
      router.push('/my/groups');
    } catch (err) {
      if (err?.details?.field) {
        setErrors(prev => ({
          ...prev,
          [err.details.field]: err.message
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          general: errorMessage(err, 'Failed to create group. Please try again.')
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-primary bg-gradient text-white">
                <h5 className="mb-0">Create New Group</h5>
              </div>
              <div className="card-body p-4">
                {error.general && (
                  <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                    <i className="bi bi-exclamation-circle-fill me-2"></i>
                    {error.general}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Group Name</label>
                    <input
                      type="text"
                      className={`form-control ${error.name ? 'is-invalid' : ''}`}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      minLength="3"
                      maxLength="50"
                      required
                    />
                                        {error.name && (
                      <div className="invalid-feedback">
                        {error.name}
                      </div>
                    )}
                    <div className="form-text">
                      Must be between 3 and 50 characters
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className={`form-control ${error.description ? 'is-invalid' : ''}`}
                      rows="4"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      minLength="10"
                      maxLength="500"
                      required
                    ></textarea>
                    {error.description && (
                      <div className="invalid-feedback">
                        {error.description}
                      </div>
                    )}
                    <div className="form-text">
                      Must be between 10 and 500 characters
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="isPublic"
                        checked={formData.isPublic}
                        onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      />
                      <label className="form-check-label" htmlFor="isPublic">
                        Make this group public
                      </label>
                    </div>
                  </div>

                  <div className="d-grid gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Creating...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-plus-circle me-2"></i>
                          Create Group
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateGroup() {
  return (
    <RequireAuth>
      <CreateGroupPage />
    </RequireAuth>
  );
}
