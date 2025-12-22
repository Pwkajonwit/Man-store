import { Timestamp } from 'firebase/firestore';

export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'picked-up' | 'returned' | 'cancelled' | 'in-progress' | 'completed';
export type UsageType = 'borrow' | 'withdraw'; // ยืมคืน | เบิก

// Booking / Equipment Usage Interface
export interface Booking {
    id: string;
    userId: string;
    userName?: string;
    userEmail?: string;

    equipmentId?: string; // ถ้าเป็น equipment
    equipmentName?: string;

    vehicleId?: string; // ถ้าเป็น vehicle
    vehicleLicensePlate?: string;

    type?: UsageType;
    status: BookingStatus;

    quantity?: number; // สำหรับเบิกวัสดุสิ้นเปลือง
    reason?: string;
    purpose?: string;
    destination?: string;

    startDate?: Timestamp | Date;
    endDate?: Timestamp | Date; // วันที่คาดว่าจะคืน

    borrowTime?: Timestamp | Date; // วันที่ยืมจริง
    returnTime?: Timestamp | Date; // วันที่คืนจริง

    createdAt?: Timestamp | Date;
    updatedAt?: Timestamp | Date;

    // Driver specific
    driverId?: string;
    driverName?: string;

    // Expenses / Mileage (Vehicle)
    startMileage?: number;
    endMileage?: number;
    totalDistance?: number;
}
