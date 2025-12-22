import { NextResponse } from 'next/server';
import admin, { isFirebaseAdminReady } from '@/lib/firebaseAdmin';

// POST /api/system/seed - สร้างข้อมูลเริ่มต้น
export async function POST(request: Request) {
    try {
        if (!isFirebaseAdminReady()) {
            return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
        }

        const body = await request.json();
        const { type } = body;

        const db = admin.firestore();
        let message = '';

        switch (type) {
            case 'settings':
                // สร้างข้อมูลการตั้งค่าเริ่มต้น
                await db.collection('settings').doc('notifications').set({
                    roles: {
                        admin: {
                            equipment_borrowed: true,
                            equipment_returned: true,
                            equipment_withdrawn: true,
                            equipment_low_stock: true,
                        },
                        employee: {
                            equipment_borrowed: true,
                            equipment_returned: true,
                            equipment_withdrawn: true,
                        },
                    },
                    dailyReport: {
                        enabled: false,
                        groupId: '',
                    },
                    equipmentCategories: [
                        'เครื่องมือไฟฟ้า',
                        'เครื่องมือช่าง',
                        'อุปกรณ์วัด',
                        'อุปกรณ์ความปลอดภัย',
                        'วัสดุสิ้นเปลือง',
                        'อะไหล่',
                        'ทั่วไป'
                    ],
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                message = 'สร้างข้อมูลการตั้งค่าเรียบร้อย';
                break;

            case 'equipment':
                // สร้างอุปกรณ์ตัวอย่าง
                const sampleEquipment = [
                    {
                        name: 'สว่านไฟฟ้า Bosch',
                        code: 'EQ-001',
                        category: 'เครื่องมือไฟฟ้า',
                        type: 'borrowable',
                        quantity: 5,
                        available: 5,
                        unit: 'เครื่อง',
                        minStock: 2,
                        status: 'active',
                        description: 'สว่านไฟฟ้าไร้สาย 18V',
                        location: 'ห้องเก็บอุปกรณ์ A',
                        imageUrl: '',
                    },
                    {
                        name: 'ประแจปากตาย ชุด',
                        code: 'EQ-002',
                        category: 'เครื่องมือช่าง',
                        type: 'borrowable',
                        quantity: 10,
                        available: 10,
                        unit: 'ชุด',
                        minStock: 3,
                        status: 'active',
                        description: 'ประแจปากตาย 8-24 มม.',
                        location: 'ห้องเก็บอุปกรณ์ A',
                        imageUrl: '',
                    },
                    {
                        name: 'มัลติมิเตอร์ดิจิตอล',
                        code: 'EQ-003',
                        category: 'อุปกรณ์วัด',
                        type: 'borrowable',
                        quantity: 3,
                        available: 3,
                        unit: 'เครื่อง',
                        minStock: 1,
                        status: 'active',
                        description: 'มัลติมิเตอร์ดิจิตอล วัดแรงดัน กระแส ความต้านทาน',
                        location: 'ห้องเก็บอุปกรณ์ B',
                        imageUrl: '',
                    },
                    {
                        name: 'สายไฟ THW 2.5 sq.mm.',
                        code: 'CS-001',
                        category: 'วัสดุสิ้นเปลือง',
                        type: 'consumable',
                        quantity: 500,
                        available: 500,
                        unit: 'เมตร',
                        minStock: 100,
                        status: 'active',
                        description: 'สายไฟ THW สีดำ',
                        location: 'ห้องพัสดุ',
                        imageUrl: '',
                    },
                    {
                        name: 'น็อตหัวเหลี่ยม M8',
                        code: 'CS-002',
                        category: 'วัสดุสิ้นเปลือง',
                        type: 'consumable',
                        quantity: 200,
                        available: 200,
                        unit: 'ตัว',
                        minStock: 50,
                        status: 'active',
                        description: 'น็อตหัวเหลี่ยม สแตนเลส',
                        location: 'ห้องพัสดุ',
                        imageUrl: '',
                    },
                    {
                        name: 'หมวกนิรภัย',
                        code: 'SF-001',
                        category: 'อุปกรณ์ความปลอดภัย',
                        type: 'borrowable',
                        quantity: 20,
                        available: 20,
                        unit: 'ใบ',
                        minStock: 5,
                        status: 'active',
                        description: 'หมวกนิรภัยสีขาว มาตรฐาน มอก.',
                        location: 'ห้องเก็บอุปกรณ์ C',
                        imageUrl: '',
                    },
                ];

                const batch = db.batch();
                for (const eq of sampleEquipment) {
                    const ref = db.collection('equipment').doc();
                    batch.set(ref, {
                        ...eq,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                await batch.commit();
                message = `สร้างอุปกรณ์ตัวอย่าง ${sampleEquipment.length} รายการเรียบร้อย`;
                break;

            case 'admin':
                // สร้าง Admin User เริ่มต้น
                const adminUser = {
                    name: 'ผู้ดูแลระบบ',
                    email: 'admin@example.com',
                    phone: '0812345678',
                    role: 'admin',
                    position: 'ผู้ดูแลระบบ',
                    lineId: '',
                    status: 'active',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                // ตรวจสอบว่ามี admin อยู่แล้วหรือไม่
                const existingAdmin = await db.collection('users')
                    .where('role', '==', 'admin')
                    .limit(1)
                    .get();

                if (existingAdmin.empty) {
                    await db.collection('users').add(adminUser);
                    message = 'สร้าง Admin User เรียบร้อย (phone: 0812345678)';
                } else {
                    message = 'มี Admin User อยู่แล้ว ไม่ต้องสร้างใหม่';
                }
                break;

            case 'all':
                // สร้างทั้งหมด
                // เรียก recursive
                const settingsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/system/seed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'settings' }),
                });
                const equipmentRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/system/seed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'equipment' }),
                });
                const adminRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/system/seed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'admin' }),
                });
                message = 'สร้างข้อมูลเริ่มต้นทั้งหมดเรียบร้อย';
                break;

            default:
                return NextResponse.json(
                    { error: 'ประเภทไม่ถูกต้อง: settings, equipment, admin, all' },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            message,
            type,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Seed data error:', error);
        return NextResponse.json(
            { error: error.message || 'ไม่สามารถสร้างข้อมูลได้' },
            { status: 500 }
        );
    }
}
