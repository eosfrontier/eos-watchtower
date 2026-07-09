import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { getLocalizedDayNumber, getDayOfWeekName } from "./time.helper";
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
}

// This will be populated from MongoDB on first use
let eventDateData = Object.assign({}, DEFAULT_EVENT_DATES);

/**
 * @description Fetch event date settings from MongoDB, with fallback to defaults
 * @return {Promise<{ocEventStartDate: Date, icEventStartDate: Date}>}
 */
export const getEventDateSettings = async () => {
    try {
        let settings = await EventDateSettings.findOne();
        
        // If no settings exist, create one with defaults
        if (!settings) {
            settings = new EventDateSettings(DEFAULT_EVENT_DATES);
            await settings.save();
        }
        
        eventDateData = {
            ocEventStartDate: settings.ocEventStartDate,
            icEventStartDate: settings.icEventStartDate,
            icStartYear: settings.icStartYear,
        };
        
        return eventDateData;
    } catch (error) {
        console.error('[TIME.CTRL] Error fetching event dates from MongoDB:', error);
        return eventDateData; // Return cached or default values on error
    }
};

/**
 * @description Update event date settings in MongoDB
 * @param {Date} ocEventStartDate
 * @param {Date} icEventStartDate
 * @param {number} icStartYear
 * @return {Promise<IEventDateSettings>}
 */
export const updateEventDateSettings = async (ocEventStartDate: Date, icEventStartDate: Date, icStartYear: number) => {
    try {
        let settings = await EventDateSettings.findOne();
        
        if (!settings) {
            settings = new EventDateSettings({
                ocEventStartDate,
                icEventStartDate,
                icStartYear,
            });
        } else {
            settings.ocEventStartDate = ocEventStartDate;
            settings.icEventStartDate = icEventStartDate;
            settings.icStartYear = icStartYear;
            settings.updatedAt = new Date();
        }
        
        await settings.save();
        eventDateData = {
            ocEventStartDate: settings.ocEventStartDate,
            icEventStartDate: settings.icEventStartDate,
            icStartYear: settings.icStartYear,
        };
        
        return settings;
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
 * @return {IcDate} converted 'input'
 */
export const convertDateObjectToIcDate = (date) => {
    if (!date) return false;

    const sourceDate = dayjs(date).utc();
    const iDayOfWeek = getLocalizedDayNumber(sourceDate.day());

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
    
    const { ocEventStartDate, icEventStartDate, icStartYear } = eventDateData;
    const _timePassed = getTimePassedSinceDate(ocEventStartDate);

    let currentIcDateValue = icEventStartDate;
    if (_timePassed > 0) {
        currentIcDateValue = dayjs(icEventStartDate)
            .utc()
            .add(_timePassed)
            .toDate();
    }

    const icDate = convertDateObjectToIcDate(currentIcDateValue);

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
