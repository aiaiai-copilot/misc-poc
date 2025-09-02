import { Result, Ok, Err } from './result';

export type DateInput = Date | number | string;
export type DateFormat = 'iso' | 'YYYY-MM-DD' | 'date-only' | 'time-only' | 'datetime-local';

export function formatDate(date: DateInput, format: DateFormat = 'iso'): string {
  try {
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    switch (format) {
      case 'iso':
        return dateObj.toISOString();
      case 'YYYY-MM-DD':
      case 'date-only':
        return dateObj.toISOString().split('T')[0];
      case 'time-only':
        return dateObj.toISOString().split('T')[1].split('.')[0];
      case 'datetime-local':
        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
      default:
        return dateObj.toISOString();
    }
  } catch {
    return 'Invalid Date';
  }
}

export function parseDate(input: DateInput): Result<Date, string> {
  if (input == null) {
    return Err('Date input cannot be null or undefined');
  }

  try {
    const date = new Date(input);
    
    if (isNaN(date.getTime())) {
      return Err(`Invalid date string: ${input}`);
    }
    
    return Ok(date);
  } catch (error) {
    return Err(`Failed to parse date: ${error}`);
  }
}

export function isValidDate(input: DateInput): boolean {
  return parseDate(input).isOk();
}

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function addDays(date: DateInput, days: number): Result<Date, string> {
  const parsedDate = parseDate(date);
  if (parsedDate.isErr()) {
    return parsedDate;
  }

  try {
    const newDate = new Date(parsedDate.unwrap());
    newDate.setDate(newDate.getDate() + days);
    return Ok(newDate);
  } catch (error) {
    return Err(`Failed to add days: ${error}`);
  }
}

export function subtractDays(date: DateInput, days: number): Result<Date, string> {
  return addDays(date, -days);
}

export function daysBetween(startDate: DateInput, endDate: DateInput): Result<number, string> {
  const start = parseDate(startDate);
  if (start.isErr()) {
    return Err(`Invalid start date: ${start.unwrapErr()}`);
  }

  const end = parseDate(endDate);
  if (end.isErr()) {
    return Err(`Invalid end date: ${end.unwrapErr()}`);
  }

  try {
    const startTime = start.unwrap().getTime();
    const endTime = end.unwrap().getTime();
    const diffInMs = endTime - startTime;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    return Ok(diffInDays);
  } catch (error) {
    return Err(`Failed to calculate days between dates: ${error}`);
  }
}