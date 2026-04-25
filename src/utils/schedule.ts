const parseTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const combineDateAndMinutes = (date: Date, minutes: number) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutes);
  return result;
};

export const enumerateDates = (fromDate: string, toDate: string) => {
  const dates: Date[] = [];
  const current = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

export const buildScheduleSlots = (input: {
  fromDate: string;
  toDate: string;
  dayStartTime: string;
  dayEndTime: string;
  slotMinutes?: number;
  excludedWeekdays?: number[];
  excludedDates?: string[];
  breakWindows?: Array<{ startTime: string; endTime: string }>;
}) => {
  const slotMinutes = input.slotMinutes ?? 30;
  const excludedDates = new Set(input.excludedDates ?? []);
  const excludedWeekdays = new Set(input.excludedWeekdays ?? []);
  const breaks = (input.breakWindows ?? []).map((breakWindow) => ({
    start: parseTimeToMinutes(breakWindow.startTime),
    end: parseTimeToMinutes(breakWindow.endTime),
  }));

  const dayStart = parseTimeToMinutes(input.dayStartTime);
  const dayEnd = parseTimeToMinutes(input.dayEndTime);

  return enumerateDates(input.fromDate, input.toDate).flatMap((date) => {
    const isoDate = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
    if (excludedDates.has(isoDate) || excludedWeekdays.has(date.getDay())) {
      return [];
    }

    const slots: Array<{ startsAt: Date; endsAt: Date }> = [];
    for (let start = dayStart; start + slotMinutes <= dayEnd; start += slotMinutes) {
      const end = start + slotMinutes;
      const overlapsBreak = breaks.some((breakWindow) => start < breakWindow.end && end > breakWindow.start);

      if (overlapsBreak) {
        continue;
      }

      slots.push({
        startsAt: combineDateAndMinutes(date, start),
        endsAt: combineDateAndMinutes(date, end),
      });
    }

    return slots;
  });
};
