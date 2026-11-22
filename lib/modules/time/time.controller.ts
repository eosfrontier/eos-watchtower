import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
    getLocalizedDayNumber,
    getDayOfWeekName,
    applyDayOfWeekOffset,
    calculateDayOfWeekOffset,
} from "./time.helper";
import { IcDate } from "../../bin/models/time";
import EventDateSettings from "../../bin/models/eventDateSettings";
import CONFIG from "../../../_config/config.json";

dayjs.extend(utc);


// TODO: dynamic dates.

// Hour placeholder: Force the time to 1200 to prevent timezone issues before dayjs/UTC can fix it.
const _HOUR_PLACEHOLDER = 12

/**
 * HEADS UP: Dates in Javascript index their months starting at 0.
 * This means if you want to set "1 january 2020" you'll need to enter:
 *      new Date(2020, 0, 1)
 * 
 *  instead of the expected 2020, 1, 1.
 */

// Default fallback dates in case MongoDB record doesn't exist
const DEFAULT_EVENT_DATES = {
    ocEventStartDate: new Date(2025, 11, 12, _HOUR_PLACEHOLDER),
    icEventStartDate: new Date(2025, 8, 26, _HOUR_PLACEHOLDER),
    icStartYear: CONFIG.icDate.yearDefault,
    icDayOfWeekOffset: 0,
}

// This will be populated from MongoDB on first use
let eventDateData = {
    ...DEFAULT_EVENT_DATES,
    icStartDayOfWeek: getLocalizedDayNumber(dayjs(DEFAULT_EVENT_DATES.ocEventStartDate).utc().day()),
};

/**
 * @description Fetch event date settings from MongoDB, with fallback to defaults
 * @return {Promise<{ocEventStartDate: Date, icEventStartDate: Date, icStartYear: number, icStartDayOfWeek: number, icDayOfWeekOffset: number}>}
 */
export const getEventDateSettings = async () => {
    try {
        let settings = await EventDateSettings.findOne();
        
        // If no settings exist, create one with defaults
        if (!settings) {
            settings = new EventDateSettings(DEFAULT_EVENT_DATES);
            await settings.save();
        }
        
        const icDayOfWeekOffset = settings.icDayOfWeekOffset ?? 0;
        const ocStartDayOfWeek = getLocalizedDayNumber(dayjs(settings.ocEventStartDate).utc().day());
        eventDateData = {
            ocEventStartDate: settings.ocEventStartDate,
            icEventStartDate: settings.icEventStartDate,
            icStartYear: settings.icStartYear,
            icStartDayOfWeek: applyDayOfWeekOffset(ocStartDayOfWeek, icDayOfWeekOffset),
            icDayOfWeekOffset,
        };
        
        return eventDateData;
    } catch (error) {
        console.error('[TIME.CTRL] Error fetching event dates from MongoDB:', error);
        return eventDateData; // Return cached or default values on error
    }
};

/**
 * @description Update event date settings in MongoDB, calculating icDayOfWeekOffset
 *              from ocEventStartDate's weekday and the requested icStartDayOfWeek (1-7).
 * @param {Date} ocEventStartDate
 * @param {Date} icEventStartDate
 * @param {number} icStartYear
 * @param {number} [icStartDayOfWeek] - Optional localized day of week (1=monday .. 7=sunday); defaults to OC start weekday
 */
export const updateEventDateSettings = async (
    ocEventStartDate: Date,
    icEventStartDate: Date,
    icStartYear: number,
    icStartDayOfWeek?: number
) => {
    try {
        const ocStartDayOfWeek = getLocalizedDayNumber(dayjs(ocEventStartDate).utc().day());
        const icDayOfWeekOffset = icStartDayOfWeek !== undefined
            ? calculateDayOfWeekOffset(ocStartDayOfWeek, icStartDayOfWeek)
            : 0;

        let settings = await EventDateSettings.findOne();
        
        if (!settings) {
            settings = new EventDateSettings({
                ocEventStartDate,
                icEventStartDate,
                icStartYear,
                icDayOfWeekOffset,
            });
        } else {
            settings.ocEventStartDate = ocEventStartDate;
            settings.icEventStartDate = icEventStartDate;
            settings.icStartYear = icStartYear;
            settings.icDayOfWeekOffset = icDayOfWeekOffset;
            settings.updatedAt = new Date();
        }
        
        await settings.save();
        const effectiveStartDayOfWeek = applyDayOfWeekOffset(ocStartDayOfWeek, icDayOfWeekOffset);
        eventDateData = {
            ocEventStartDate: settings.ocEventStartDate,
            icEventStartDate: settings.icEventStartDate,
            icStartYear: settings.icStartYear,
            icStartDayOfWeek: effectiveStartDayOfWeek,
            icDayOfWeekOffset,
        };
        
        return {
            _id: settings._id,
            ocEventStartDate: settings.ocEventStartDate,
            icEventStartDate: settings.icEventStartDate,
            icStartYear: settings.icStartYear,
            icStartDayOfWeek: effectiveStartDayOfWeek,
            icDayOfWeekOffset,
            updatedAt: settings.updatedAt,
        };
    } catch (error) {
        console.error('[TIME.CTRL] Error updating event dates:', error);
        throw error;
    }
};

/**
 * @description Calculate and return the amount of hours between event start and -now-
 * @param {Date} ocEventStart
 * @return {Number} amount of time (Ms) passed, minimum of 0
 */
export const getTimePassedSinceDate = (startDate) => {
    let diff = 0;

    if (startDate) {
        const now = dayjs().utc().hour(23);
        const start = dayjs(startDate).utc();

        diff = now.diff(start) > 0 ? now.diff(start) : 0;
    }
    return diff;
};

/**
 *
 * @param {Date} date
 * @param {number} [dayOfWeekOverride] - Optional localized day of week (1=monday .. 7=sunday)
 * @return {IcDate | false} converted 'input'
 */
export const convertDateObjectToIcDate = (date, dayOfWeekOverride?: number) => {
    if (!date) return false;

    const sourceDate = dayjs(date).utc();
    const iDayOfWeek = dayOfWeekOverride !== undefined
        ? applyDayOfWeekOffset(dayOfWeekOverride, 0)
        : getLocalizedDayNumber(sourceDate.day());

    const input = {
        iDayOfWeek,
        iDayName: getDayOfWeekName(iDayOfWeek),
        iDay: sourceDate.date(),
        iMonth: sourceDate.month() + 1,
        iMonthName: sourceDate.format('MMMM').toLowerCase(),
    };

    return new IcDate(input);
};

export const getCurrentIcDate = async () => {
    // Fetch latest settings from MongoDB
    await getEventDateSettings();
    
    const { ocEventStartDate, icEventStartDate, icStartYear, icDayOfWeekOffset } = eventDateData;
    const _timePassed = getTimePassedSinceDate(ocEventStartDate);

    let currentIcDateValue = icEventStartDate;
    if (_timePassed > 0) {
        currentIcDateValue = dayjs(icEventStartDate)
            .utc()
            .add(_timePassed)
            .toDate();
    }

    // Start from the OC event start day of week, advance by the elapsed UTC calendar
    // days matching currentIcDateValue, and apply any configured day-of-week offset.
    const ocStartDayOfWeek = getLocalizedDayNumber(dayjs(ocEventStartDate).utc().day());
    const daysSinceStart = dayjs(currentIcDateValue)
        .utc()
        .startOf('day')
        .diff(dayjs(icEventStartDate).utc().startOf('day'), 'day');
    const iDayOfWeek = applyDayOfWeekOffset(
        ocStartDayOfWeek,
        daysSinceStart + (icDayOfWeekOffset ?? 0)
    );

    const icDate = convertDateObjectToIcDate(currentIcDateValue, iDayOfWeek);

    // The IC year is based on the difference between the current REAL year
    // and the REAL start year of the event, added to the IC start year.
    if (icDate) {
        const ocEventStartYear = dayjs(ocEventStartDate).utc().year();
        const currentRealWorldYear = dayjs.utc().year();
        const yearDifference = currentRealWorldYear - ocEventStartYear;
        icDate.iYear = icStartYear + (yearDifference > 0 ? yearDifference : 0);
    }
    return icDate;
};
