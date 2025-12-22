import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import { isFirebaseAdminReady } from '@/lib/firebaseAdmin';

export async function GET() {
    try {
        // ตรวจสอบว่า Firebase Admin พร้อมใช้งาน
        if (!isFirebaseAdminReady()) {
            return NextResponse.json({
                roles: {
                    admin: { equipment_borrowed: true, equipment_returned: true, equipment_withdrawn: true, equipment_low_stock: true },
                    employee: { equipment_borrowed: true, equipment_returned: true, equipment_withdrawn: true }
                },
                dailyReport: { enabled: false, groupId: '' },
                equipmentCategories: ['เครื่องมือไฟฟ้า', 'เครื่องมือช่าง', 'อุปกรณ์วัด', 'อุปกรณ์ความปลอดภัย', 'วัสดุสิ้นเปลือง', 'อะไหล่', 'ทั่วไป']
            });
        }

        const db = admin.firestore();
        const doc = await db.collection('settings').doc('notifications').get();

        if (!doc.exists) {
            return NextResponse.json({
                roles: {
                    admin: { equipment_borrowed: true, equipment_returned: true, equipment_withdrawn: true, equipment_low_stock: true },
                    employee: { equipment_borrowed: true, equipment_returned: true, equipment_withdrawn: true }
                },
                dailyReport: { enabled: false, groupId: '' },
                equipmentCategories: ['เครื่องมือไฟฟ้า', 'เครื่องมือช่าง', 'อุปกรณ์วัด', 'อุปกรณ์ความปลอดภัย', 'วัสดุสิ้นเปลือง', 'อะไหล่', 'ทั่วไป']
            });
        }

        return NextResponse.json(doc.data());
    } catch (error) {
        console.error('Error getting notification settings:', error);
        return NextResponse.json({
            roles: {},
            dailyReport: { enabled: false, groupId: '' },
            equipmentCategories: []
        });
    }
}

export async function POST(request: Request) {
    try {
        if (!isFirebaseAdminReady()) {
            return NextResponse.json({ error: 'Firebase Admin not ready' }, { status: 500 });
        }

        const body = await request.json();
        const db = admin.firestore();

        await db.collection('settings').doc('notifications').set({
            roles: body.roles || {},
            dailyReport: body.dailyReport || { enabled: false, groupId: '' },
            equipmentCategories: body.equipmentCategories || [],
            updatedAt: new Date()
        }, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error saving notification settings:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
