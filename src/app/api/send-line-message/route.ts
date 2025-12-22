import { Client } from '@line/bot-sdk';
import { NextResponse } from 'next/server';

// Lazy initialization - สร้าง client เมื่อต้องการใช้เท่านั้น
let client: Client | null = null;

const getClient = () => {
    if (!client && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        client = new Client({
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET || '',
        });
    }
    return client;
};

export async function POST(request: Request) {
    try {
        const lineClient = getClient();

        if (!lineClient) {
            return NextResponse.json({ success: false, message: 'LINE credentials not configured' }, { status: 503 });
        }

        const body = await request.json();
        const { to, message } = body;

        if (!to || !message) {
            return NextResponse.json({ message: 'Missing "to" or "message" in request body' }, { status: 400 });
        }

        // Create a text message object
        const messageObject: any = {
            type: 'text',
            text: message,
        };

        // Send the push message
        await lineClient.pushMessage(to, messageObject);

        return NextResponse.json({ success: true, message: `Message sent to ${to}` });

    } catch (error: any) {
        console.error('Error sending LINE message:', error.originalError?.response?.data || error);
        return NextResponse.json({ success: false, message: 'Failed to send message' }, { status: 500 });
    }
}
