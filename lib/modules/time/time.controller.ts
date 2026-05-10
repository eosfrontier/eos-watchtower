const dayjs = require('dayjs');
const UTC = require('dayjs/plugin/utc');
const {
    getLocalizedDayNumber,
    getDayOfWeekName,
} = require("./time.helper");
const { IcDate } = require("../../bin/models/time");
import { SOCKET_TIME_UPDATE } from "../../shared/constants.sockets";
import { Server } from "../../bin/server";
import EventDateSettings from "../../bin/models/eventDateSettings";

dayjs.extend(UTC);


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
}

// This will be populated from MongoDB on first use
let eventDateData = { ...DEFAULT_EVENT_DATES };

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
 * @return {Promise<IEventDateSettings>}
 */
export const updateEventDateSettings = async (ocEventStartDate: Date, icEventStartDate: Date) => {
    try {
        let settings = await EventDateSettings.findOne();
        
        if (!settings) {
            settings = new EventDateSettings({
                ocEventStartDate,
                icEventStartDate,
            });
        } else {
            settings.ocEventStartDate = ocEventStartDate;
            settings.icEventStartDate = icEventStartDate;
            settings.updatedAt = new Date();
        }
        
        await settings.save();
        eventDateData = {
            ocEventStartDate: settings.ocEventStartDate,
            icEventStartDate: settings.icEventStartDate,
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
    
    const { ocEventStartDate, icEventStartDate } = eventDateData;
    const _timePassed = getTimePassedSinceDate(ocEventStartDate);

    let currentRealDate = icEventStartDate;
    if (_timePassed > 0) {
        currentRealDate = dayjs(icEventStartDate)
            .utc()
            .add(_timePassed)
            .toDate();
    }

    const icDate = convertDateObjectToIcDate(currentRealDate);

    // The old implementation was missing the IC Year calculation.
    // Let's re-implement it based on the logic from OLD.time.controller.ts
    if (icDate) {
        const icStartYear = require('../../../_config/config.json').icDate.yearDefault;
        const icEventStartYear = dayjs(icEventStartDate).utc().year();
        const currentRealDateYear = dayjs(currentRealDate).utc().year();
        const yearDifference = currentRealDateYear - icEventStartYear;
        icDate.iYear = icStartYear + (yearDifference > 0 ? yearDifference : 0);
    }
    return icDate;
};
