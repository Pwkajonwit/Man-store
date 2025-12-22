import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
    // ตรวจสอบว่า admin SDK พร้อมใช้งานหรือไม่
    if (!admin.apps.length) {
        return NextResponse.json({ error: 'Firebase Admin SDK not initialized.' }, { status: 500 });
    }

    try {
        const { email, password, name, role, lineId, phone } = await request.json();

        // normalize phone if provided
        let normalizedPhone = null;
        if (phone) {
            const digits = String(phone).replace(/\D/g, '');
            if (digits.length !== 10) {
                return NextResponse.json({ error: 'Phone must be 10 digits' }, { status: 400 });
            }
            normalizedPhone = digits;
        }

        if (!email || !password || !name || !role) {
            return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
        }

        // 1. สร้างผู้ใช้ใน Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name,
        });

        // 2. สร้างโปรไฟล์ผู้ใช้ใน Firestore
        const userDoc: any = {
            name: name,
            email: email,
            role: role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (lineId) userDoc.lineId = lineId;
        if (normalizedPhone) userDoc.phone = normalizedPhone;

        await admin.firestore().collection('users').doc(userRecord.uid).set(userDoc);

        return NextResponse.json({ message: 'User created successfully', uid: userRecord.uid }, { status: 201 });

    } catch (error: any) {
        console.error('Error creating user:', error);
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 409 });
        }
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' }, { status: 500 });
    }
}
