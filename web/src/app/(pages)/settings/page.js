'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../../../hooks/useTheme';
import { authApi, usersApi, errorMessage } from '../../../lib/api';
import RequireAuth from '../../../components/auth/RequireAuth';

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    gender: '',
    blurb: ''
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const data = await usersApi.mySettings();
      const settings = data?.settings ?? {};
      setUserData({
        username: settings.username || '',
        email: settings.email || '',
        gender: settings.gender || '',
        blurb: settings.blurb || ''
      });
    } catch (err) {
      setError(errorMessage(err, 'Failed to load user data'));
    }
  };

  const handleThemeChange = async (newTheme) => {
    setLoading(true);
    setError(null);
    // ThemeContext applies the theme locally and saves it to the account when possible.
    await setTheme(newTheme);
    setSuccess('Theme updated successfully');
    setTimeout(() => setSuccess(null), 3000);
    setLoading(false);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await usersApi.updateMe({ blurb: userData.blurb, gender: userData.gender });
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(errorMessage(err, 'Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    try {
      setLoading(true);
      setError(null);
      await authApi.forgotPassword(userData.email);
      setResetEmailSent(true);
      setSuccess('Password reset email sent. Please check your inbox.');
      setTimeout(() => {
        setSuccess(null);
        setResetEmailSent(false);
      }, 5000);
    } catch (err) {
      setError(errorMessage(err, 'Failed to send password reset email'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-5 bg-body-tertiary">
      <div className="container">
        <div className="row">
          {/* Sidebar Navigation */}
        <div className="col-md-3">
          <div className="list-group">
            <button className={`list-group-item list-group-item-action ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
              <i className="bi bi-person-circle me-2"></i>Profile
            </button>
            <button className={`list-group-item list-group-item-action ${activeTab === 'appearance' ? 'active' : ''}`} onClick={() => setActiveTab('appearance')}>
              <i className="bi bi-palette me-2"></i>Appearance
            </button>
            <button className={`list-group-item list-group-item-action ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
              <i className="bi bi-shield-lock me-2"></i>Security
            </button>
            <button className={`list-group-item list-group-item-action ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => setActiveTab('privacy')}>
              <i className="bi bi-eye me-2"></i>Privacy
            </button>
            <button className={`list-group-item list-group-item-action ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <i className="bi bi-bell me-2"></i>Notifications
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="col-md-9">
          <div className="card shadow-sm">
            {error && (
              <div className="alert alert-danger m-3">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success m-3">
                <i className="bi bi-check-circle me-2"></i>
                {success}
              </div>
            )}

            {/* Profile Settings */}
            {activeTab === 'profile' && (
                <div className="card-body">
                    <h4 className="card-title mb-4">Profile Settings</h4>
                    <form onSubmit={handleProfileUpdate}>
                        <div className="mb-3">
                        <label className="form-label">Username</label>
                        <input type="text" className="form-control" value={userData.username} disabled readOnly />
                        </div>
                        <div className="mb-3">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-control" value={userData.email} disabled readOnly />
                        </div>
                        <div className="mb-3">
                        <label className="form-label">Gender</label>
                        <select className="form-select" value={userData.gender} onChange={(e) => setUserData({...userData, gender: e.target.value})}>
                            <option value="">Select gender...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                        </div>
                        <div className="mb-3">
                        <label className="form-label">Bio</label>
                        <textarea className="form-control" rows="3" maxLength="100" value={userData.blurb} onChange={(e) => setUserData({...userData, blurb: e.target.value})}></textarea>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            )}

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="card-body">
                <h4 className="card-title mb-4">Appearance Settings</h4>
                <div className="mb-4">
                  <label className="form-label">Theme Mode</label>
                  <div className="d-flex gap-3">
                    <button className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => handleThemeChange('light')} disabled={loading}>
                      <i className="bi bi-sun me-2"></i>
                      Light
                    </button>
                    <button className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => handleThemeChange('dark')} disabled={loading}>
                      <i className="bi bi-moon me-2"></i>
                      Dark
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Placeholder tabs */}
            {activeTab === 'security' && (
              <div className="card-body">
                <h4 className="card-title mb-4">Security Settings</h4>
                <div className="mb-4">
                  <h5>Password Reset</h5>
                  <p className="text-muted">
                    Need to change your password? Click below to receive a password reset link via email.
                  </p>
                  <button 
                    className="btn btn-primary"
                    onClick={handlePasswordResetRequest}
                    disabled={loading || resetEmailSent}
                  >
                    {loading ? 'Sending...' : resetEmailSent ? 'Email Sent!' : 'Send Reset Link'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="card-body">
                <h4 className="card-title">Privacy Settings</h4>
                <p className="text-muted">Privacy settings coming soon...</p>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="card-body">
                <h4 className="card-title">Notification Settings</h4>
                <p className="text-muted">Notification settings coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

export default function Settings() {
  return (
    <RequireAuth>
      <SettingsPage />
    </RequireAuth>
  );
}