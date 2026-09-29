'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../../../hooks/useTheme';
import { usersApi, errorMessage } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import RequireAuth from '../../../components/auth/RequireAuth';

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userData, setUserData] = useState({
    username: '',
    displayName: '',
    description: ''
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
        displayName: settings.displayName || '',
        description: settings.description || ''
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
      const displayName = userData.displayName.trim();
      await usersApi.updateMe({ displayName: displayName || null, description: userData.description });
      await refreshUser();
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(errorMessage(err, 'Failed to update profile'));
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
                        <label className="form-label" htmlFor="displayName">Display Name</label>
                        <input id="displayName" type="text" className="form-control" maxLength={32} placeholder={userData.username} value={userData.displayName} onChange={(e) => setUserData({...userData, displayName: e.target.value})} />
                        <div className="form-text">Shown on your profile. Leave empty to use your username.</div>
                        </div>
                        <div className="mb-3">
                        <label className="form-label" htmlFor="description">Bio</label>
                        <textarea id="description" className="form-control" rows="3" maxLength={1000} value={userData.description} onChange={(e) => setUserData({...userData, description: e.target.value})}></textarea>
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
                  <h5>Password</h5>
                  <p className="text-muted">
                    Changing your password will be available in a future update.
                  </p>
                  <button className="btn btn-primary" disabled>
                    Change Password
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