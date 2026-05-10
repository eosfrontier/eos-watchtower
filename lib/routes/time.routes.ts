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
         * @description update the event date settings
         * @param {Date} ocEventStartDate - OC event start date
         * @param {Date} icEventStartDate - IC event start date
         */
        router.route('/settings').post(async (req, res) => {
            try {
                const { ocEventStartDate, icEventStartDate } = req.body;

                if (!ocEventStartDate || !icEventStartDate) {
                    return res.status(400).send({
                        error: 'Missing required fields: ocEventStartDate and icEventStartDate'
                    });
                }

                const settings = await updateEventDateSettings(
                    new Date(ocEventStartDate),
                    new Date(icEventStartDate)
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
        });

        /**
         * @description get the current event date settings
         */
        router.route('/settings').get(async (req, res) => {
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
        });

        console.log('[RO] ..DateTime Routes added.');
        return router;
    }
}
