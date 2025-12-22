import { Client, FlexMessage } from '@line/bot-sdk';
import { NextResponse } from 'next/server';

// Lazy initialization
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
        const { to, flexMessage } = body;

        if (!to || !flexMessage) {
            return NextResponse.json({ message: 'Missing "to" or "flexMessage" in request body' }, { status: 400 });
        }

        // Create a flex message object
        const messageObject: FlexMessage = {
            type: 'flex',
            altText: flexMessage.altText || 'แจ้งเตือน',
            contents: flexMessage.contents,
        };

        // Send the push message
        await lineClient.pushMessage(to, messageObject);

        return NextResponse.json({ success: true, message: `Flex message sent to ${to}` });

    } catch (error: any) {
        console.error('Error sending LINE flex message:', error.originalError?.response?.data || error);
        return NextResponse.json({ success: false, message: 'Failed to send flex message' }, { status: 500 });
    }
}
