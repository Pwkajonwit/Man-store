import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import { Client } from '@line/bot-sdk';
import { repairReportFlex, repairCompletedFlex } from '@/lib/lineFlexMessages';

const db = admin.firestore();

let lineClient: Client | null = null;
const getLineClient = () => {
    if (!lineClient && process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        lineClient = new Client({
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET || '',
        });
    }
    return lineClient;
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { repair, type } = body; // type: 'report' | 'complete'

        if (!repair || !type) {
            return NextResponse.json({ success: false, error: 'Missing repair data or type' }, { status: 400 });
        }

        // 1. Check Settings
        const notifyDoc = await db.collection('settings').doc('notifications').get();
        let notifyRepairStatus = true; // Default to true
        if (notifyDoc.exists) {
            const data = notifyDoc.data() as any;
            // lineConfig is stored as 'line' field map
            if (data.line && typeof data.line.notifyRepairStatus !== 'undefined') {
                notifyRepairStatus = data.line.notifyRepairStatus;
            }
        }

        if (!notifyRepairStatus) {
            console.log('Repair notification disabled in settings');
            return NextResponse.json({ success: true, message: 'Notification disabled in settings' });
        }

        // 2. Get User LINE ID
        const userId = repair.reportedBy;
        if (!userId) {
            return NextResponse.json({ success: false, error: 'No reportedBy user ID' }, { status: 400 });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.log(`User ${userId} not found`);
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data() as any;
        const lineId = userData.lineId;

        if (!lineId) {
            console.log(`User ${userId} has no LINE ID`);
            return NextResponse.json({ success: true, message: 'User has no LINE ID' });
        }

        // 3. Prepare Message
        let flexMessage = null;
        if (type === 'report') {
            flexMessage = repairReportFlex(repair);
        } else if (type === 'complete') {
            flexMessage = repairCompletedFlex(repair);
        }

        if (!flexMessage) {
            return NextResponse.json({ success: false, error: 'Invalid notification type' }, { status: 400 });
        }

        // 4. Send Message
        const client = getLineClient();
        if (!client) {
            console.error('LINE Client not configured');
            return NextResponse.json({ success: false, error: 'LINE Client not configured' }, { status: 503 });
        }

        const message: any = {
            type: 'flex',
            altText: flexMessage.altText,
            contents: flexMessage.contents
        };

        await client.pushMessage(lineId, message);
        console.log(`Sent repair notification (${type}) to ${lineId}`);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error sending repair notification:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
