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
 * Get end of this week in YYYY-MM-DD format (local timezone)
 */
export const getWeekFromNowString = (): string => {
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay())); // Sunday is end of week
  
  const year = endOfWeek.getFullYear();
  const month = String(endOfWeek.getMonth() + 1).padStart(2, '0');
  const day = String(endOfWeek.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Get end of this month in YYYY-MM-DD format (local timezone)
 */
export const getMonthFromNowString = (): string => {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
  
  const year = endOfMonth.getFullYear();
  const month = String(endOfMonth.getMonth() + 1).padStart(2, '0');
  const day = String(endOfMonth.getDate()).padStart(2, '0');
  
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

/**
 * Round minutes to nearest 5 minute interval
 */
export const roundToNearest5Minutes = (date: Date): Date => {
  const roundedDate = new Date(date);
  const minutes = roundedDate.getMinutes();
  const roundedMinutes = Math.round(minutes / 5) * 5;
  roundedDate.setMinutes(roundedMinutes, 0, 0); // Also clear seconds and milliseconds
  return roundedDate;
};

/**
 * Round minutes to nearest 15 minute interval
 */
export const roundToNearest15Minutes = (date: Date): Date => {
  const roundedDate = new Date(date);
  const minutes = roundedDate.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  roundedDate.setMinutes(roundedMinutes, 0, 0); // Also clear seconds and milliseconds
  return roundedDate;
};

/**
 * Get minimum allowed start time (current time + 5 minutes, rounded to next 15-minute interval)
 */
export const getMinimumStartTime = (): Date => {
  const now = new Date();
  const minTime = new Date(now.getTime() + 5 * 60 * 1000); // Add 5 minutes
  
  // Round up to next 15-minute interval
  const minutes = minTime.getMinutes();
  const nextQuarter = Math.ceil(minutes / 15) * 15;
  
  if (nextQuarter === 60) {
    minTime.setHours(minTime.getHours() + 1);
    minTime.setMinutes(0, 0, 0);
  } else {
    minTime.setMinutes(nextQuarter, 0, 0);
  }
  
  return minTime;
};

/**
 * Add one hour to a date, handling day rollover
 */
export const addOneHourWithDayRollover = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(newDate.getHours() + 1);
  return newDate;
};

/**
 * Add one hour to a date
 */
export const addOneHour = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(newDate.getHours() + 1);
  return newDate;
};

/**
 * Calculate duration between two dates in hours and minutes
 */
export const calculateDuration = (startDate: Date, endDate: Date): string => {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  if (hours === 0) {
    return `${minutes} min`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
};

/**
 * Convert datetime-local string to rounded 5-minute intervals
 */
export const roundDateTimeStringTo5Minutes = (dateTimeString: string): string => {
  if (!dateTimeString) return dateTimeString;
  
  // For datetime-local, the string is already in local timezone format
  // We need to parse it properly and then round
  const date = new Date(dateTimeString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return dateTimeString;
  }
  
  const roundedDate = roundToNearest5Minutes(date);
  return toLocalDateTimeString(roundedDate);
};