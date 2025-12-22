// API: Test LINE Messaging API (Token from .env, Group ID from request)
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { groupId } = await request.json();
        const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

        if (!channelAccessToken) {
            return NextResponse.json({
                error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน .env'
            }, { status: 400 });
        }

        if (!groupId) {
            return NextResponse.json({ error: 'กรุณาใส่ Group ID' }, { status: 400 });
        }

        const now = new Date();
        const thaiDate = now.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Simple text message for testing
        const testMessage = {
            type: "text",
            text: `🧪 ทดสอบการแจ้งเตือน\n\n✅ เชื่อมต่อสำเร็จ!\n📅 ${thaiDate}\n⏰ ${now.toLocaleTimeString('th-TH')}\n\n🔧 Equipment Management System`
        };

        const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelAccessToken}`,
            },
            body: JSON.stringify({
                to: groupId,
                messages: [testMessage]
            }),
        });

        const responseText = await lineRes.text();
        let errorData: any = {};
        try {
            errorData = JSON.parse(responseText);
        } catch {
            errorData = { message: responseText };
        }

        if (lineRes.ok) {
            return NextResponse.json({ success: true, message: 'ส่งข้อความสำเร็จ' });
        } else {
            console.error('LINE API error:', lineRes.status, errorData);

            let errorMessage = 'ไม่สามารถส่งข้อความได้';
            if (errorData.message) {
                if (errorData.message.includes('Invalid reply token') || errorData.message.includes('not found')) {
                    errorMessage = 'Group ID ไม่ถูกต้อง หรือ Bot ยังไม่ได้เข้ากลุ่ม';
                } else if (errorData.message.includes('authentication')) {
                    errorMessage = 'Channel Access Token ไม่ถูกต้อง';
                } else {
                    errorMessage = errorData.message;
                }
            }

            return NextResponse.json({
                success: false,
                error: errorMessage,
                details: errorData
            }, { status: 400 });
        }
    } catch (error: any) {
        console.error('LINE Messaging API test error:', error);
        return NextResponse.json({ error: 'เกิดข้อผิดพลาด: ' + error.message }, { status: 500 });
    }
}
