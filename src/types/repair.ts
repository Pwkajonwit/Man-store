export type RepairStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';

export interface Repair {
    id: string;
    equipmentId: string;
    equipmentName: string;
    equipmentImage?: string;
    description?: string; // Sometimes used as 'note'
    note?: string;
    imageUrl?: string; // Alias for equipmentImage sometimes

    // Cost & Tech
    cost?: number;
    technician?: string;

    reporterName?: string;
    reportedBy?: string; // Line ID or User ID

    status: RepairStatus;
    createdAt: any; // Firestore Timestamp
    updatedAt: any;
    completedAt?: any;
}
