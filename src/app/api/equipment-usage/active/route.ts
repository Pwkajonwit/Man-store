// API: ดึงรายการอุปกรณ์ที่กำลังยืมอยู่
import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'กรุณาระบุ userId' },
                { status: 400 }
            );
        }

        // Get active borrow records for this user
        const snapshot = await admin.firestore()
            .collection('equipment-usage')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .where('type', '==', 'borrow')
            .get();

        const activeUsages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                borrowTime: data.borrowTime?.toDate?.() || data.borrowTime,
                expectedReturnDate: data.expectedReturnDate?.toDate?.() || data.expectedReturnDate,
            };
        });

        return NextResponse.json({ success: true, activeUsages });
    } catch (error) {
        console.error('Error fetching active equipment usage:', error);
        return NextResponse.json(
            { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
            { status: 500 }
        );
    }
}
