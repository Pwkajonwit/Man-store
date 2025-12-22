export type EquipmentStatus = 'available' | 'maintenance' | 'borrowed' | 'reserved' | 'damaged' | 'repairing' | 'low_stock' | 'out_of_stock' | 'active';

export interface Equipment {
    id: string;
    name: string;
    type: 'equipment' | 'vehicle' | 'consumable' | 'borrowable';
    status: EquipmentStatus;
    imageUrl?: string;
    description?: string;
    category?: string;
    location?: string;
    reportedBy?: string; // For repair reporting

    // Inventory (Consumable)
    quantity?: number;
    availableQuantity?: number;
    unit?: string;

    // Vehicle details
    licensePlate?: string;
    province?: string;
    brand?: string;
    model?: string;
    code?: string; // Sometimes used

    createdAt?: any;
    updatedAt?: any;
}
