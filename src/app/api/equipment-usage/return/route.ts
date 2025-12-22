import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { usageId, returnQuantity, note } = body;

        // Validate required fields
        if (!usageId) {
            return NextResponse.json(
                { error: 'กรุณาระบุข้อมูลให้ครบถ้วน: usageId' },
                { status: 400 }
            );
        }

        // Get usage record
        const usageRef = admin.firestore().collection('equipment-usage').doc(usageId);
        const usageDoc = await usageRef.get();

        if (!usageDoc.exists) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการยืมอุปกรณ์' }, { status: 404 });
        }

        const usageData = usageDoc.data();
        if (!usageData) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลการยืมอุปกรณ์' }, { status: 500 });
        }

        if (usageData.status !== 'active') {
            return NextResponse.json(
                { error: 'การยืมนี้ได้คืนไปแล้ว' },
                { status: 400 }
            );
        }

        if (usageData.type !== 'borrow') {
            return NextResponse.json(
                { error: 'รายการนี้เป็นการเบิก ไม่สามารถคืนได้' },
                { status: 400 }
            );
        }

        // Calculate return quantity
        const qtyToReturn = returnQuantity !== undefined ? Number(returnQuantity) : usageData.quantity;

        if (qtyToReturn > usageData.quantity) {
            return NextResponse.json(
                { error: 'จำนวนคืนมากกว่าจำนวนที่ยืม' },
                { status: 400 }
            );
        }

        // Update usage record
        await usageRef.update({
            returnTime: new Date(),
            returnQuantity: qtyToReturn,
            returnNote: note || '',
            status: 'returned',
            updatedAt: new Date(),
        });

        // Update equipment available quantity
        const equipmentRef = admin.firestore().collection('equipment').doc(usageData.equipmentId);
        const equipmentDoc = await equipmentRef.get();

        if (equipmentDoc.exists) {
            const equipmentData = equipmentDoc.data();
            if (equipmentData) {
                const newAvailableQuantity = (equipmentData.availableQuantity || 0) + qtyToReturn;

                const updateData: any = {
                    availableQuantity: newAvailableQuantity,
                    updatedAt: new Date(),
                };

                // Update status if items are now available
                if (equipmentData.status === 'out_of_stock' && newAvailableQuantity > 0) {
                    updateData.status = 'available';
                }

                await equipmentRef.update(updateData);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'คืนอุปกรณ์สำเร็จ',
            returnQuantity: qtyToReturn,
        });
    } catch (error: any) {
        console.error('Error returning equipment:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการคืนอุปกรณ์' },
            { status: 500 }
        );
    }
}
