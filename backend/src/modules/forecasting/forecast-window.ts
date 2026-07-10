const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export type ForecastWindow = {
  startMonth: string;
  endMonth: string;
  months: string[];
};

function padMonth(month: number) {
  return String(month).padStart(2, "0");
}

export function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}`;
}

export function parseMonthKey(monthKey: string) {
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return {
    month,
    year
  };
}

export function addMonths(monthKey: string, monthsToAdd: number) {
  const parsed = parseMonthKey(monthKey);
  const monthIndex = parsed.year * 12 + (parsed.month - 1) + monthsToAdd;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;

  return `${year}-${padMonth(month)}`;
}

export function monthStartIso(monthKey: string) {
  parseMonthKey(monthKey);

  return `${monthKey}-01`;
}

export function buildForecastWindow(startMonth: string, horizon = 12): ForecastWindow {
  const months = Array.from({ length: horizon }, (_, index) => addMonths(startMonth, index));

  return {
    endMonth: months.at(-1) ?? startMonth,
    months,
    startMonth
  };
}

export function getActiveForecastMonth() {
  const configuredMonth = process.env.FORECAST_CURRENT_MONTH?.trim();

  if (configuredMonth) {
    parseMonthKey(configuredMonth);
    return configuredMonth;
  }

  return toMonthKey(new Date());
}
