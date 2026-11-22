import mongoose = require('mongoose');

export interface IEventDateSettings extends mongoose.Document {
    _id: string;
    ocEventStartDate: Date;
    icEventStartDate: Date;
    icStartYear: number;
    icDayOfWeekOffset?: number;
    updatedAt?: Date;
}

export const EventDateSettingsSchema = new mongoose.Schema({
    ocEventStartDate: { type: Date, required: true },
    icEventStartDate: { type: Date, required: true },
    icStartYear: { type: Number, required: true },
    icDayOfWeekOffset: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

const EventDateSettings = mongoose.model('EventDateSettings', EventDateSettingsSchema);
export default EventDateSettings;
