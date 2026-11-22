import dayjs from "dayjs";
import UTC from "dayjs/plugin/utc";

dayjs.extend(UTC);

export const DAY_NAMES = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
];

/**
 * @optional {Number} dayNumber, (0-6 from Date Objects)
 * @returns 1-7 daynumbers for Sunday-Last formatting
 */
export const getLocalizedDayNumber = (day = dayjs.utc().day()) => day === 0 ? 7 : day;

/**
 * Calculate the day-of-week offset (0-6) from an OC start day (1-7)
 * to a target IC start day (1-7).
 * @param {Number} ocDayOfWeek (1 - 7)
 * @param {Number} icDayOfWeek (1 - 7)
 * @returns 0-6 offset (e.g. Friday 5 -> Sunday 7 returns 2)
 */
export const calculateDayOfWeekOffset = (ocDayOfWeek: number, icDayOfWeek: number): number => {
    return (((icDayOfWeek - ocDayOfWeek) % 7) + 7) % 7;
};

/**
 * @param {Number} dayNumber (1 - 7)
 * @param {Number} [offset=0] - Integer day-of-week offset (positive, negative, or 0)
 * @returns 1-7 localized day number wrapped within Monday (1) - Sunday (7)
 */
export const applyDayOfWeekOffset = (dayNumber: number, offset: number = 0): number => {
    const zeroBased = (((dayNumber - 1 + offset) % 7) + 7) % 7;
    return zeroBased + 1;
};

/**
 * @param {Number} dayNumber (1 - 7)
 * @returns string (monday - sunday)
 */
export const getDayOfWeekName = (dayNumber?) => {
    const dayIndex = (dayNumber || getLocalizedDayNumber()) - 1;
    return DAY_NAMES[dayIndex];
};