/**
 * Date utility functions for formatting dates and times
 */

/**
 * Formats a date to a human-readable relative time (e.g., "2 hours ago", "3 days ago")
 * @param {string|Date} date - The date to format
 * @returns {string} The formatted relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return 'N/A';
  
  const now = new Date();
  const dateObj = new Date(date);
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  const seconds = Math.floor((now - dateObj) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) {
    return seconds <= 5 ? 'Just now' : `${seconds} seconds ago`;
  } else if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (days < 30) {
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else if (months < 12) {
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
};

/**
 * Formats a date to a standard date and time format
 * @param {string|Date} date - The date to format
 * @param {Object} options - Formatting options
 * @returns {string} The formatted date string
 */
export const formatDateTime = (date, options = {}) => {
  if (!date) return 'N/A';
  
  const dateObj = new Date(date);
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  const defaultOptions = {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  return dateObj.toLocaleString('en-US', { ...defaultOptions, ...options });
};

/**
 * Formats a date to show only the date part
 * @param {string|Date} date - The date to format
 * @returns {string} The formatted date string
 */
export const formatDate = (date) => {
  if (!date) return 'N/A';
  
  const dateObj = new Date(date);
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  return dateObj.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
};