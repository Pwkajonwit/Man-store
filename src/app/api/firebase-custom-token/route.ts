// src/app/api/firebase-custom-token/route.ts

import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin'; // 1. Import Admin SDK (default export)

// ไม่จำเป็นต้องใช้ LINE SDK ในไฟล์นี้แล้ว
// import { Client } from '@line/bot-sdk';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { idToken } = body;

        if (!idToken) {
            return NextResponse.json({ error: 'ID token is required.' }, { status: 400 });
        }

        // --- 4. แก้ไขขั้นตอนการตรวจสอบ ID Token กับ LINE ---
        // เพื่อความปลอดภัยสูงสุด เราต้องแน่ใจว่า Token นี้มาจาก LINE จริงๆ
        let lineProfilePayload;
        try {
            const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    id_token: idToken,
                    // ใช้ LIFF ID ของคุณเป็น client_id
                    // คุณอาจต้องตรวจสอบให้แน่ใจว่าใช้ LIFF ID ที่ถูกต้องสำหรับแอปของคุณ
                    client_id: process.env.NEXT_PUBLIC_LIFF_ID || process.env.NEXT_PUBLIC_CONFIRM_LIFF_ID || ''
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('LINE token verification failed:', response.status, errorBody);
                throw new Error('Invalid or expired LINE token.');
            }
            lineProfilePayload = await response.json();

        } catch (lineError) {
            console.error('LINE token verification failed:', lineError);
            return NextResponse.json({ error: 'Invalid or expired LINE token.' }, { status: 401 });
        }

        // 5. ใช้ userId ที่ได้จากการ verify แล้วเท่านั้น (จะอยู่ใน property 'sub')
        const uid = lineProfilePayload.sub;

        if (!uid) {
            return NextResponse.json({ error: 'Could not get user ID from LINE token.' }, { status: 401 });
        }

        // 6. สร้าง Custom Token จาก Firebase Admin SDK
        const customToken = await admin.auth().createCustomToken(uid);

        return NextResponse.json({ customToken });

    } catch (error) {
        console.error('Custom token creation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
