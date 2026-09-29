import Filter from 'leo-profanity';

// Initialize the filter with the default English list
Filter.loadDictionary();

export const containsBadWords = (text) => {
  if (!text) return false;
  
  // Convert to lowercase for consistent checking
  return Filter.check(text.toLowerCase());
};