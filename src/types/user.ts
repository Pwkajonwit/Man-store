// src/types/user.ts
import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'employee' | 'driver';

export interface UserProfile {
    id: string; // Document ID
    uid?: string; // Firebase Auth UID (often same as id)
    email?: string;
    displayName?: string;
    name?: string;
    role: UserRole;
    position?: string;
    phone?: string;
    phoneNumber?: string; // Legacy/Alias
    lineId?: string;
    imageUrl?: string;
    linePictureUrl?: string; // Specific to LINE
    pictureUrl?: string; // from LINE
    photoURL?: string; // from Firebase Auth
    status?: string;
    createdAt?: Timestamp | Date;
    updatedAt?: Timestamp | Date;
    lastLogin?: Timestamp | Date;
}
