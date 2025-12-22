import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import { sendNotificationsForEvent } from '@/lib/notifications';

const db = admin.firestore();
const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.NEXT_PUBLIC_LINE_CHANNEL_ACCESS_TOKEN || '';

function normalizeBooking(b: any) {
    if (!b) return null;
    return {
        id: b.id || b.bookingId || b._id || '',
        requesterName: b.requesterName || b.requester || b.userName || '',
        userEmail: b.userEmail || b.requesterEmail || b.requester?.email || '',
        vehicleLicensePlate: b.vehicleLicensePlate || b.vehicle?.licensePlate || b.vehicleId || '',
        startDate: b.startDate || b.from || null,
        endDate: b.endDate || b.to || null,
        returnedAt: b.returnedAt || null
    };
}

async function sendPushMessage(to: string, message: any) {
    if (!ACCESS_TOKEN) throw new Error('LINE channel access token not configured');
    // Ensure message is in correct LINE format (type: 'flex' or 'text')
    let payload: any[];
    if (Array.isArray(message)) {
        payload = message.map(m => {
            if (m.contents) {
                return { type: 'flex', altText: m.altText || '', contents: m.contents };
            } else if (m.text || m.altText) {
                return { type: 'text', text: m.text || m.altText || '' };
            } else {
                return m;
            }
        });
    } else if (message.contents) {
        payload = [{ type: 'flex', altText: message.altText || '', contents: message.contents }];
    } else if (message.text || message.altText) {
        payload = [{ type: 'text', text: message.text || message.altText || '' }];
    } else {
        payload = [message];
    }
    const body = { to, messages: payload };
    // DEBUG LOG: แสดง payload ที่จะส่งไป LINE API
    console.error('[LINE_PUSH] payload:', JSON.stringify(body, null, 2));
    const resp = await fetch(LINE_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ACCESS_TOKEN}`
        },
        body: JSON.stringify(body)
    });
    if (!resp.ok) {
        const txt = await resp.text().catch(() => 'no body');
        const err: any = new Error('line_push_failed');
        err.status = resp.status;
        err.body = txt;
        throw err;
    }
    return true;
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const { event, booking } = body;
        if (!booking) return NextResponse.json({ ok: false, error: 'missing booking' }, { status: 400 });

        const b = normalizeBooking(booking); // Unused but kept for structure

        // Load notification settings (with defaults)
        let notifSettings = { roles: {} };
        try {
            const cfgSnap = await db.collection('appConfig').doc('notifications').get();
            if (cfgSnap.exists) notifSettings = cfgSnap.data() as any;
        } catch (e) {
            console.error('Failed to load notification settings, using defaults', e);
        }

        // Delegate to helper which handles templates, settings and delivery
        try {
            const results = await sendNotificationsForEvent(event, booking);
            return NextResponse.json({ ok: true, results });
        } catch (e) {
            console.error('Error sending notifications for event', event, e);
            return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
        }
    } catch (err) {
        console.error('POST /api/notifications/send error', err);
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
}
