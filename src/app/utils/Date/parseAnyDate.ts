export const parseAnyDate = (dateString: string): Date => {
    console.log("show date",dateString)
  if (!dateString) return new Date();
  
  // Remove any whitespace
  const cleanDateString = dateString.trim();
  
  // Try parsing as ISO format (YYYY-MM-DD)
  const isoDate = new Date(cleanDateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try parsing as MM/DD/YYYY or M/D/YYYY format
  if (cleanDateString.includes('/')) {
    const parts = cleanDateString.split('/').map(part => part.trim());
    
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // Months are 0-indexed
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      
      console.log("show month",month, day, year)
      // Validate date components
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }
  
  // Try parsing as DD-MM-YYYY or D-M-YYYY format
  if (cleanDateString.includes('-')) {
    const parts = cleanDateString.split('-').map(part => part.trim());
    
    if (parts.length === 3) {
      // Check if it's likely DD-MM-YYYY format (day first)
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
      const year = parseInt(parts[2], 10);
      
      // Validate date components
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }
  
  // Try parsing as timestamp
  const timestamp = Date.parse(cleanDateString);
  if (!isNaN(timestamp)) {
    return new Date(timestamp);
  }
  
  // Fallback to current date if format is unrecognized
  console.warn(`Unrecognized date format: ${dateString}. Using current date.`);
  return new Date();
};

export const createDateFilter = (startDate?: string, endDate?: string, field: string = 'createdAt'): any => {
  const filter: any = {};
  
  if (startDate || endDate) {
    filter[field] = {};
    
    if (startDate) {
      const start = parseAnyDate(startDate);
      start.setHours(0, 0, 0, 0); // Start of the day
      filter[field].gte = start;
    }
    
    if (endDate) {
      const end = parseAnyDate(endDate);
      end.setHours(23, 59, 59, 999); // End of the day
      filter[field].lte = end;
    }
  }
  
  return filter;
};