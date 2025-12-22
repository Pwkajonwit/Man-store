import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
    // Check for environment variables
    const missingEnvVars = [];
    if (!process.env.FIREBASE_PROJECT_ID) missingEnvVars.push('FIREBASE_PROJECT_ID');
    if (!process.env.FIREBASE_CLIENT_EMAIL) missingEnvVars.push('FIREBASE_CLIENT_EMAIL');
    if (!process.env.FIREBASE_PRIVATE_KEY) missingEnvVars.push('FIREBASE_PRIVATE_KEY');

    if (missingEnvVars.length > 0) {
        console.error('Missing Firebase Admin Env Vars:', missingEnvVars);
        return NextResponse.json(
            { error: `Server Error: Missing environment variables: ${missingEnvVars.join(', ')}` },
            { status: 500 }
        );
    }

    // Check if Firebase Admin is initialized
    if (admin.apps.length === 0) {
        console.error('Firebase Admin not initialized (Apps length is 0)');
        // Attempt manual check of creds again just in case initialization failed despite vars interacting
        return NextResponse.json(
            { error: 'System Error: Firebase Admin failed to initialize. Check your FIREBASE_PRIVATE_KEY format.' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const {
            userId,
            userName,
            equipmentId,
            quantity = 1,
            purpose,
            expectedReturnDate,
        } = body;

        // Validate required fields
        if (!userId || !equipmentId) {
            return NextResponse.json(
                { error: 'กรุณาระบุข้อมูลให้ครบถ้วน: userId, equipmentId' },
                { status: 400 }
            );
        }

        const requestedQty = Number(quantity);
        if (isNaN(requestedQty) || requestedQty <= 0) {
            return NextResponse.json({ error: 'จำนวนต้องมากกว่า 0' }, { status: 400 });
        }

        // Check if equipment exists and is available
        const equipmentRef = admin.firestore().collection('equipment').doc(equipmentId);
        const equipmentDoc = await equipmentRef.get();

        if (!equipmentDoc.exists) {
            return NextResponse.json({ error: 'ไม่พบอุปกรณ์นี้ในระบบ' }, { status: 404 });
        }

        const equipmentData = equipmentDoc.data();
        if (!equipmentData) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลอุปกรณ์' }, { status: 500 });
        }

        // Check if equipment type is borrowable
        if (equipmentData.type !== 'borrowable') {
            return NextResponse.json(
                { error: 'อุปกรณ์นี้เป็นประเภทเบิก ไม่สามารถยืมได้' },
                { status: 400 }
            );
        }

        // Check available quantity
        if (equipmentData.availableQuantity < requestedQty) {
            return NextResponse.json(
                { error: `อุปกรณ์ไม่เพียงพอ (คงเหลือ ${equipmentData.availableQuantity} ${equipmentData.unit})` },
                { status: 400 }
            );
        }

        // Create equipment-usage record
        const usageData = {
            equipmentId,
            equipmentName: equipmentData.name,
            equipmentCode: equipmentData.code || '',
            equipmentImageUrl: equipmentData.imageUrl || '',
            equipmentCategory: equipmentData.category || '',
            equipmentLocation: equipmentData.location || '',
            userId,
            userName: userName || 'ไม่ระบุชื่อ',
            type: 'borrow', // ยืม
            quantity: requestedQty,
            unit: equipmentData.unit || 'ชิ้น',
            borrowTime: new Date(),
            returnTime: null,
            expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
            purpose: purpose || '',
            status: 'active', // active | returned
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const usageRef = await admin.firestore().collection('equipment-usage').add(usageData);

        // Update equipment available quantity
        const newAvailableQuantity = equipmentData.availableQuantity - requestedQty;
        const updateData: any = {
            availableQuantity: newAvailableQuantity,
            updatedAt: new Date(),
        };

        // Update status if no more available
        if (newAvailableQuantity <= 0) {
            updateData.status = 'out_of_stock';
        }

        await equipmentRef.update(updateData);

        return NextResponse.json({
            success: true,
            usageId: usageRef.id,
            message: 'ยืมอุปกรณ์สำเร็จ',
        });
    } catch (error: any) {
        console.error('Error borrowing equipment:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการยืมอุปกรณ์: ' + (error.message || 'Unknown error') },
            { status: 500 }
        );
    }
}
