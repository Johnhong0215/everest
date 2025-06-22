// Timezone-aware date utilities for consistent date handling across the app

/**
 * Get the user's timezone
 */
export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Convert a Date object to local datetime-local format (YYYY-MM-DDTHH:mm)
 */
export const toLocalDateTimeString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Convert datetime-local string to Date object in user's timezone
 */
export const fromLocalDateTimeString = (dateTimeString: string): Date => {
  // datetime-local is already in the user's local timezone
  return new Date(dateTimeString);
};

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
export const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Get tomorrow's date in YYYY-MM-DD format (local timezone)
 */
export const getTomorrowString = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Get date one week from now in YYYY-MM-DD format (local timezone)
 */
export const getWeekFromNowString = (): string => {
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  const year = weekFromNow.getFullYear();
  const month = String(weekFromNow.getMonth() + 1).padStart(2, '0');
  const day = String(weekFromNow.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Get date one month from now in YYYY-MM-DD format (local timezone)
 */
export const getMonthFromNowString = (): string => {
  const monthFromNow = new Date();
  monthFromNow.setMonth(monthFromNow.getMonth() + 1);
  
  const year = monthFromNow.getFullYear();
  const month = String(monthFromNow.getMonth() + 1).padStart(2, '0');
  const day = String(monthFromNow.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Check if a date string matches any of the quick filter dates
 */
export const isQuickFilterDate = (dateString: string): boolean => {
  const quickDates = [
    getTodayString(),
    getTomorrowString(),
    getWeekFromNowString(),
    getMonthFromNowString()
  ];
  return quickDates.includes(dateString);
};

/**
 * Format a date for display using the user's locale and timezone
 */
export const formatDateForDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(dateObj);
};

/**
 * Check if a date is today in the user's timezone
 */
export const isToday = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  return dateObj.toDateString() === today.toDateString();
};

/**
 * Check if a date is within a date range (inclusive)
 */
export const isDateInRange = (date: Date | string, startDate: Date, endDate: Date): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  return dateObj >= startOfDay && dateObj <= endOfDay;
};