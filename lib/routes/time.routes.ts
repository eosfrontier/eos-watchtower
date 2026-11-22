import { Router } from 'express';
import { getCurrentIcDate, getEventDateSettings, updateEventDateSettings } from "../modules/time/time.controller";
export class TimeRoutes {
    public static getRoutes(): Router {
        const router = Router();

        /**
         * @description get the current IC date / time. */
        router.route('/').get(async (req, res) => {
            try {
                const icDate = await getCurrentIcDate();
                res.status(200).send(icDate);
            } catch (error) {
                console.error('[TIME.ROUTES] Error fetching IC date:', error);
                res.status(500).send({
                    error: 'Failed to fetch IC date',
                    details: error.message
                });
            }
        });

        /**
         * @description update the event date settings (POST and PUT)
         * @param {Date} ocEventStartDate - OC event start date
         * @param {Date} icEventStartDate - IC event start date
         * @param {number} icStartYear - IC start year
         * @param {number} [icStartDayOfWeek] - Optional starting IC day of week (1=monday .. 7=sunday); offset is calculated from ocEventStartDate
         */
        const handleUpdateSettings = async (req, res) => {
            try {
                const { ocEventStartDate, icEventStartDate, icStartYear, icStartDayOfWeek } = req.body || {};

                if (
                    !ocEventStartDate ||
                    !icEventStartDate ||
                    icStartYear === undefined ||
                    icStartYear === null ||
                    icStartYear === ''
                ) {
                    return res.status(400).send({
                        error: 'Missing required fields: ocEventStartDate, icEventStartDate, and icStartYear'
                    });
                }

                const parsedOcDate = new Date(ocEventStartDate);
                const parsedIcDate = new Date(icEventStartDate);
                if (Number.isNaN(parsedOcDate.getTime()) || Number.isNaN(parsedIcDate.getTime())) {
                    return res.status(400).send({
                        error: 'Invalid date format for ocEventStartDate or icEventStartDate'
                    });
                }

                if (typeof icStartYear !== 'number' && typeof icStartYear !== 'string') {
                    return res.status(400).send({
                        error: 'Invalid icStartYear: must be a number'
                    });
                }
                const trimmedStartYear = typeof icStartYear === 'string' ? icStartYear.trim() : icStartYear;
                if (trimmedStartYear === '') {
                    return res.status(400).send({
                        error: 'Missing required fields: ocEventStartDate, icEventStartDate, and icStartYear'
                    });
                }
                const parsedStartYear = Number(trimmedStartYear);
                if (!Number.isFinite(parsedStartYear)) {
                    return res.status(400).send({
                        error: 'Invalid icStartYear: must be a number'
                    });
                }

                let parsedStartDayOfWeek: number | undefined;
                if (icStartDayOfWeek !== undefined && icStartDayOfWeek !== null && icStartDayOfWeek !== '') {
                    if (typeof icStartDayOfWeek !== 'number' && typeof icStartDayOfWeek !== 'string') {
                        return res.status(400).send({
                            error: 'Invalid icStartDayOfWeek: must be an integer from 1 (monday) to 7 (sunday)'
                        });
                    }
                    const trimmedDay = typeof icStartDayOfWeek === 'string'
                        ? icStartDayOfWeek.trim()
                        : icStartDayOfWeek;
                    if (trimmedDay !== '') {
                        const dayNumber = Number(trimmedDay);
                        if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 7) {
                            return res.status(400).send({
                                error: 'Invalid icStartDayOfWeek: must be an integer from 1 (monday) to 7 (sunday)'
                            });
                        }
                        parsedStartDayOfWeek = dayNumber;
                    }
                }

                const settings = await updateEventDateSettings(
                    parsedOcDate,
                    parsedIcDate,
                    parsedStartYear,
                    parsedStartDayOfWeek
                );

                res.status(200).send({
                    message: 'Event date settings updated successfully',
                    data: settings
                });
            } catch (error) {
                console.error('[TIME.ROUTES] Error updating settings:', error);
                res.status(500).send({
                    error: 'Failed to update event date settings',
                    details: error.message
                });
            }
        };

        /**
         * @description get or update the current event date settings
         */
        router.route('/settings')
            .get(async (req, res) => {
                try {
                    const settings = await getEventDateSettings();
                    res.status(200).send(settings);
                } catch (error) {
                    console.error('[TIME.ROUTES] Error fetching settings:', error);
                    res.status(500).send({
                        error: 'Failed to fetch event date settings',
                        details: error.message
                    });
                }
            })
            .post(handleUpdateSettings)
            .put(handleUpdateSettings);

        console.log('[RO] ..DateTime Routes added.');
        return router;
    }
}
