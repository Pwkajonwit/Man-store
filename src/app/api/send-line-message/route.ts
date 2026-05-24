import { Client } from '@line/bot-sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

function parseLineError(error: any) {
    const responseData = error?.originalError?.response?.data || error?.response?.data;
    if (responseData) {
        return typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
    }

    return error?.message || 'Failed to send message';
}

export async function POST(request: Request) {
    try {
        const lineClient = getClient();

        if (!lineClient) {
            return NextResponse.json({ success: false, message: 'LINE credentials not configured' }, { status: 503 });
        }

        const body = await request.json();
        const { to, message } = body;
        const text = typeof message === 'string' ? message.trim() : '';
        const recipient = typeof to === 'string' ? to.trim() : '';

        if (!recipient || !text) {
            return NextResponse.json({ message: 'Missing "to" or "message" in request body' }, { status: 400 });
        }

        // Create a text message object
        const messageObject: any = {
            type: 'text',
            text,
        };

        // Send the push message
        await lineClient.pushMessage(recipient, messageObject);

        return NextResponse.json({ success: true, message: `Message sent to ${recipient}` });

    } catch (error: any) {
        const detail = parseLineError(error);
        console.error('Error sending LINE message:', detail);
        return NextResponse.json({ success: false, message: 'Failed to send message', detail }, { status: 500 });
    }
}
