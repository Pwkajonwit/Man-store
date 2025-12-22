import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            userId,
            userName,
            equipmentId,
            quantity = 1,
            purpose,
            jobReference, // อ้างอิงงาน/โปรเจค
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

        // Check if equipment type is consumable
        if (equipmentData.type !== 'consumable') {
            return NextResponse.json(
                { error: 'อุปกรณ์นี้เป็นประเภทยืมคืน กรุณาใช้เมนูยืมแทน' },
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
            type: 'withdraw', // เบิก
            quantity: requestedQty,
            unit: equipmentData.unit || 'ชิ้น',
            withdrawTime: new Date(),
            purpose: purpose || '',
            jobReference: jobReference || '',
            status: 'completed', // เบิกแล้วจบเลย
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const usageRef = await admin.firestore().collection('equipment-usage').add(usageData);

        // Update equipment quantity (ลดทั้ง quantity และ availableQuantity เพราะเบิกแล้วไม่คืน)
        const newQuantity = (equipmentData.quantity || 0) - requestedQty;
        const newAvailableQuantity = (equipmentData.availableQuantity || 0) - requestedQty;

        const updateData: any = {
            quantity: newQuantity,
            availableQuantity: newAvailableQuantity,
            updatedAt: new Date(),
        };

        // Update status based on remaining quantity
        if (newQuantity <= 0) {
            updateData.status = 'out_of_stock';
        } else if (newQuantity <= (equipmentData.minStock || 0)) {
            updateData.status = 'low_stock';
        }

        await equipmentRef.update(updateData);

        return NextResponse.json({
            success: true,
            usageId: usageRef.id,
            message: 'เบิกอุปกรณ์สำเร็จ',
            remainingQuantity: newQuantity,
        });
    } catch (error: any) {
        console.error('Error withdrawing equipment:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการเบิกอุปกรณ์' },
            { status: 500 }
        );
    }
}
