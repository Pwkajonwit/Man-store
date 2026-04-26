import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';
import { equipmentSummaryFlex } from '@/lib/equipmentSummaryFlex';

export const runtime = 'nodejs';

type TriggerType = 'morning' | 'evening';

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.NEXT_PUBLIC_LINE_CHANNEL_ACCESS_TOKEN || '';
const TRIGGER_SECRET = process.env.EQUIPMENT_NOTIFICATION_TRIGGER_SECRET || process.env.CRON_SECRET || process.env.SCHEDULE_TRIGGER_SECRET || '';
const CONFIGURED_TARGET = process.env.EQUIPMENT_NOTIFICATION_LINE_TO || process.env.LINE_EQUIPMENT_NOTIFICATION_TO || process.env.LINE_GROUP_ID || '';

function normalizeTriggerType(value: string | null | undefined): TriggerType | null {
    const normalized = String(value || '').trim().toLowerCase();

    if (['morning', 'borrow', 'borrow_list', 'list', '9', '09', '09:00', '900'].includes(normalized)) {
        return 'morning';
    }

    if (['evening', 'summary', 'unreturned', 'not_returned', '17', '17:00', '1700'].includes(normalized)) {
        return 'evening';
    }

    return null;
}

function getSecretFromRequest(request: Request, body: any, searchParams: URLSearchParams) {
    return (
        request.headers.get('x-cron-secret') ||
        request.headers.get('x-trigger-secret') ||
        searchParams.get('secret') ||
        body?.secret ||
        ''
    );
}

function assertAuthorized(request: Request, body: any, searchParams: URLSearchParams) {
    if (!TRIGGER_SECRET) {
        const error: any = new Error('trigger_secret_not_configured');
        error.status = 500;
        throw error;
    }

    if (getSecretFromRequest(request, body, searchParams) !== TRIGGER_SECRET) {
        const error: any = new Error('unauthorized');
        error.status = 401;
        throw error;
    }
}

function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isOverdue(expectedReturnDate: any) {
    const date = toDate(expectedReturnDate);
    return !!date && date.getTime() < Date.now();
}

function getBangkokDateKey(value: Date) {
    return value.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

function isTodayBangkok(value: any) {
    const date = toDate(value);
    if (!date) return false;

    return getBangkokDateKey(date) === getBangkokDateKey(new Date());
}

function parseLineError(error: any) {
    const raw = error?.body || error?.message || String(error);

    try {
        const parsed = JSON.parse(raw);
        return parsed.message || raw;
    } catch {
        return raw;
    }
}

async function sendLineFlex(to: string, message: any) {
    if (!ACCESS_TOKEN) throw new Error('LINE channel access token not configured');

    const response = await fetch(LINE_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
            to,
            messages: [{
                type: 'flex',
                altText: message.altText,
                contents: message.contents,
            }],
        }),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => 'no body');
        const error: any = new Error('line_push_failed');
        error.status = response.status;
        error.body = detail;
        throw error;
    }
}

async function getActiveBorrowUsages(): Promise<any[]> {
    const snapshot = await admin.firestore()
        .collection('equipment-usage')
        .where('status', '==', 'active')
        .where('type', '==', 'borrow')
        .get();

    return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => {
            const aExpected = toDate(a.expectedReturnDate)?.getTime() || Number.MAX_SAFE_INTEGER;
            const bExpected = toDate(b.expectedReturnDate)?.getTime() || Number.MAX_SAFE_INTEGER;
            if (aExpected !== bExpected) return aExpected - bExpected;

            const aBorrow = toDate(a.borrowTime)?.getTime() || 0;
            const bBorrow = toDate(b.borrowTime)?.getTime() || 0;
            return aBorrow - bBorrow;
        });
}

async function getTodayReturnedUsages(): Promise<any[]> {
    const snapshot = await admin.firestore()
        .collection('equipment-usage')
        .where('status', '==', 'returned')
        .where('type', '==', 'borrow')
        .get();

    return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((usage: any) => isTodayBangkok(usage.returnTime))
        .sort((a: any, b: any) => {
            const aReturnTime = toDate(a.returnTime)?.getTime() || 0;
            const bReturnTime = toDate(b.returnTime)?.getTime() || 0;
            return bReturnTime - aReturnTime;
        });
}

async function getSettingsGroupId() {
    try {
        const doc = await admin.firestore()
            .collection('settings')
            .doc('notifications')
            .get();

        const groupId = doc.exists ? doc.data()?.line?.groupId : '';
        return typeof groupId === 'string' ? groupId.trim() : '';
    } catch (error) {
        console.warn('Failed to load LINE groupId from settings/notifications:', error);
        return '';
    }
}

async function getLineSettings() {
    try {
        const doc = await admin.firestore()
            .collection('settings')
            .doc('notifications')
            .get();

        const line = doc.exists ? doc.data()?.line || {} : {};
        return {
            groupId: typeof line.groupId === 'string' ? line.groupId.trim() : '',
            notifyBorrowSummary: line.notifyBorrowSummary !== false,
            notifyReturnSummary: line.notifyReturnSummary !== false,
            notifyAdminUserIds: Array.isArray(line.notifyAdminUserIds) ? line.notifyAdminUserIds : [],
        };
    } catch (error) {
        console.warn('Failed to load LINE settings:', error);
        return {
            groupId: '',
            notifyBorrowSummary: true,
            notifyReturnSummary: true,
            notifyAdminUserIds: [],
        };
    }
}

async function getSelectedAdminLineIds(adminUserIds: string[]) {
    const ids = adminUserIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
    if (ids.length === 0) return [];

    const lineIds: string[] = [];
    for (const id of ids) {
        try {
            const doc = await admin.firestore().collection('users').doc(id).get();
            const lineId = doc.exists ? doc.data()?.lineId : '';
            if (typeof lineId === 'string' && lineId.trim()) {
                lineIds.push(lineId.trim());
            }
        } catch (error) {
            console.warn('Failed to load selected admin lineId:', id, error);
        }
    }

    return lineIds;
}

async function getRecipients(body: any) {
    const requestRecipients = [
        ...(Array.isArray(body?.recipients) ? body.recipients : []),
        body?.to,
        body?.groupId,
    ].filter((value) => typeof value === 'string' && value.trim().length > 0);

    if (requestRecipients.length > 0) {
        return Array.from(new Set(requestRecipients.map((value) => value.trim())));
    }

    const lineSettings = await getLineSettings();
    const settingsRecipients = [
        lineSettings.groupId,
        ...(await getSelectedAdminLineIds(lineSettings.notifyAdminUserIds)),
    ].filter((value) => typeof value === 'string' && value.trim().length > 0);

    if (settingsRecipients.length > 0) {
        return Array.from(new Set(settingsRecipients.map((value) => value.trim())));
    }

    if (CONFIGURED_TARGET) return [CONFIGURED_TARGET.trim()];

    const adminSnapshot = await admin.firestore()
        .collection('users')
        .where('role', '==', 'admin')
        .get();

    return Array.from(new Set(
        adminSnapshot.docs
            .map((doc) => doc.data()?.lineId)
            .filter((lineId) => typeof lineId === 'string' && lineId.trim().length > 0)
            .map((lineId) => lineId.trim())
    ));
}

async function handleTrigger(request: Request) {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    try {
        assertAuthorized(request, body, url.searchParams);
    } catch (error: any) {
        const isMissingSecret = error?.message === 'trigger_secret_not_configured';
        return NextResponse.json({
            success: false,
            error: isMissingSecret ? 'Trigger secret is not configured' : 'unauthorized',
        }, { status: error.status || 401 });
    }

    if (admin.apps.length === 0) {
        return NextResponse.json({ success: false, error: 'Firebase Admin is not initialized' }, { status: 500 });
    }

    const type = normalizeTriggerType(body?.type || body?.action || url.searchParams.get('type') || url.searchParams.get('action'));
    if (!type) {
        return NextResponse.json({
            success: false,
            error: 'Invalid trigger type. Use morning or evening.',
        }, { status: 400 });
    }

    const lineSettings = await getLineSettings();
    const enabled = type === 'morning'
        ? lineSettings.notifyBorrowSummary
        : lineSettings.notifyReturnSummary;

    if (!enabled) {
        return NextResponse.json({
            success: true,
            skipped: true,
            type,
            reason: type === 'morning' ? 'borrow_summary_disabled' : 'return_summary_disabled',
        });
    }

    const activeBorrowUsages = await getActiveBorrowUsages();
    const returnedUsages = type === 'evening' ? await getTodayReturnedUsages() : [];
    const recipients = await getRecipients(body);

    if (recipients.length === 0) {
        return NextResponse.json({
            success: false,
            error: 'No LINE recipients configured. Add Group ID in settings or configure EQUIPMENT_NOTIFICATION_LINE_TO.',
            activeBorrowCount: activeBorrowUsages.length,
        }, { status: 400 });
    }

    const message = type === 'evening'
        ? equipmentSummaryFlex('return', returnedUsages, {
            title: 'สรุปการคืน',
            generatedAt: new Date(),
            pendingUsages: activeBorrowUsages,
        })
        : equipmentSummaryFlex('borrow', activeBorrowUsages, {
            title: 'สรุปรายการยืม',
            generatedAt: new Date(),
        });
    const results = { sent: [] as string[], errors: [] as Array<{ to: string; error: string }> };

    for (const recipient of recipients) {
        try {
            await sendLineFlex(recipient, message);
            results.sent.push(recipient);
        } catch (error: any) {
            console.error('Scheduled equipment notification failed:', recipient, error);
            results.errors.push({ to: recipient, error: parseLineError(error) });
        }
    }

    try {
        await admin.firestore().collection('scheduled-notification-logs').add({
            type,
            channel: 'line',
            format: 'flex',
            activeBorrowCount: activeBorrowUsages.length,
            returnedCount: returnedUsages.length,
            overdueCount: activeBorrowUsages.filter((usage) => isOverdue(usage.expectedReturnDate)).length,
            recipientsCount: recipients.length,
            sentCount: results.sent.length,
            errorCount: results.errors.length,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.warn('Failed to write scheduled notification log:', error);
    }

    return NextResponse.json({
        success: results.errors.length === 0,
        type,
        activeBorrowCount: activeBorrowUsages.length,
        returnedCount: returnedUsages.length,
        overdueCount: activeBorrowUsages.filter((usage) => isOverdue(usage.expectedReturnDate)).length,
        recipientsCount: recipients.length,
        results,
    }, { status: results.errors.length === recipients.length ? 502 : 200 });
}

export async function GET(request: Request) {
    return handleTrigger(request);
}

export async function POST(request: Request) {
    return handleTrigger(request);
}
