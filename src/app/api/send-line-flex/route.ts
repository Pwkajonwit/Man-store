import { Client, FlexMessage } from '@line/bot-sdk';
import { sanitizeFlexMessage } from '@/lib/lineFlex';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

    return error?.message || 'Failed to send flex message';
}

export async function POST(request: Request) {
    try {
        const lineClient = getClient();

        if (!lineClient) {
            return NextResponse.json({ success: false, message: 'LINE credentials not configured' }, { status: 503 });
        }

        const body = await request.json();
        const { to, flexMessage } = body;
        const recipient = typeof to === 'string' ? to.trim() : '';

        if (!recipient || !flexMessage?.contents) {
            return NextResponse.json({ message: 'Missing "to" or "flexMessage" in request body' }, { status: 400 });
        }

        const safeFlexMessage = sanitizeFlexMessage(flexMessage);
        const messageObject: FlexMessage = {
            type: 'flex',
            altText: safeFlexMessage.altText,
            contents: safeFlexMessage.contents,
        };

        await lineClient.pushMessage(recipient, messageObject);

        return NextResponse.json({ success: true, message: `Flex message sent to ${recipient}` });

    } catch (error: any) {
        const detail = parseLineError(error);
        console.error('Error sending LINE flex message:', detail);
        return NextResponse.json({ success: false, message: 'Failed to send flex message', detail }, { status: 500 });
    }
}
