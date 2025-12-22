import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

// GET: ดึงรายการอุปกรณ์ทั้งหมด หรือตาม query
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'borrowable' | 'consumable' | all
        const status = searchParams.get('status'); // 'available' | 'in_use' | 'low_stock' | all
        const category = searchParams.get('category'); // หมวดหมู่

        let query: FirebaseFirestore.Query = admin.firestore().collection('equipment');

        // Filter by type
        if (type && type !== 'all') {
            query = query.where('type', '==', type);
        }

        // Filter by status
        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }

        // Filter by category
        if (category && category !== 'all') {
            query = query.where('category', '==', category);
        }

        const snapshot = await query.get();
        const equipment = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ success: true, equipment });
    } catch (error) {
        console.error('Error fetching equipment:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอุปกรณ์' },
            { status: 500 }
        );
    }
}

// POST: เพิ่มอุปกรณ์ใหม่
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            name,
            code,
            category,
            type, // 'borrowable' (ยืมคืน) | 'consumable' (เบิก)
            quantity,
            unit,
            minStock,
            imageUrl,
            description,
            location,
        } = body;

        // Validate required fields
        if (!name || !type) {
            return NextResponse.json(
                { error: 'กรุณาระบุชื่อและประเภทอุปกรณ์' },
                { status: 400 }
            );
        }

        const equipmentData = {
            name,
            code: code || '',
            category: category || 'ทั่วไป',
            type, // 'borrowable' | 'consumable'
            quantity: Number(quantity) || 1,
            availableQuantity: Number(quantity) || 1, // จำนวนที่พร้อมใช้งาน
            unit: unit || 'ชิ้น',
            minStock: Number(minStock) || 0,
            imageUrl: imageUrl || '',
            description: description || '',
            location: location || '',
            status: 'available',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const docRef = await admin.firestore().collection('equipment').add(equipmentData);

        return NextResponse.json({
            success: true,
            id: docRef.id,
            message: 'เพิ่มอุปกรณ์สำเร็จ',
        });
    } catch (error) {
        console.error('Error adding equipment:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์' },
            { status: 500 }
        );
    }
}

// PUT: แก้ไขอุปกรณ์
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'กรุณาระบุ ID อุปกรณ์' },
                { status: 400 }
            );
        }

        const docRef = admin.firestore().collection('equipment').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json(
                { error: 'ไม่พบอุปกรณ์ในระบบ' },
                { status: 404 }
            );
        }

        // Update quantity logic
        const currentData = doc.data();
        if (updateData.quantity !== undefined && currentData) {
            const diff = Number(updateData.quantity) - (currentData.quantity || 0);
            updateData.availableQuantity = Math.max(0, (currentData.availableQuantity || 0) + diff);
        }

        await docRef.update({
            ...updateData,
            updatedAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            message: 'แก้ไขอุปกรณ์สำเร็จ',
        });
    } catch (error) {
        console.error('Error updating equipment:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการแก้ไขอุปกรณ์' },
            { status: 500 }
        );
    }
}

// DELETE: ลบอุปกรณ์
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'กรุณาระบุ ID อุปกรณ์' },
                { status: 400 }
            );
        }

        const docRef = admin.firestore().collection('equipment').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json(
                { error: 'ไม่พบอุปกรณ์ในระบบ' },
                { status: 404 }
            );
        }

        await docRef.delete();

        return NextResponse.json({
            success: true,
            message: 'ลบอุปกรณ์สำเร็จ',
        });
    } catch (error) {
        console.error('Error deleting equipment:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการลบอุปกรณ์' },
            { status: 500 }
        );
    }
}
