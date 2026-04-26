import { NextResponse } from 'next/server';
import { equipmentSummaryFlex, EquipmentSummaryType } from '@/lib/equipmentSummaryFlex';

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.NEXT_PUBLIC_LINE_CHANNEL_ACCESS_TOKEN || '';

function parseLineError(error: any) {
    const raw = error?.body || error?.message || 'เกิดข้อผิดพลาดในการส่งสรุป';

    try {
        const parsed = JSON.parse(raw);
        return parsed.message || raw;
    } catch {
        return raw;
    }
}

async function sendLineFlex(to: string, message: any) {
    if (!ACCESS_TOKEN) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');

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

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
        const recipients = Array.isArray(body.recipients)
            ? body.recipients.filter((value: any) => typeof value === 'string' && value.trim().length > 0).map((value: string) => value.trim())
            : [];
        const type: EquipmentSummaryType | null = body.type === 'return' ? 'return' : body.type === 'borrow' ? 'borrow' : null;
        const usages = Array.isArray(body.items) ? body.items : [];
        const pendingUsages = Array.isArray(body.pendingItems) ? body.pendingItems : [];

        const targets = Array.from(new Set([groupId, ...recipients].filter(Boolean)));

        if (targets.length === 0) {
            return NextResponse.json({ success: false, error: 'กรุณาใส่ Group ID หรือเลือกแอดมินอย่างน้อย 1 คน' }, { status: 400 });
        }

        if (!type) {
            return NextResponse.json({ success: false, error: 'ประเภทสรุปไม่ถูกต้อง' }, { status: 400 });
        }

        const message = equipmentSummaryFlex(type, usages, {
            title: type === 'borrow' ? 'สรุปรายการยืม' : 'สรุปการคืน',
            generatedAt: new Date(),
            pendingUsages,
        });

        const results = { sent: [] as string[], errors: [] as Array<{ to: string; error: string }> };

        for (const target of targets) {
            try {
                await sendLineFlex(target, message);
                results.sent.push(target);
            } catch (error: any) {
                results.errors.push({ to: target, error: parseLineError(error) });
            }
        }

        if (results.sent.length === 0) {
            return NextResponse.json({
                success: false,
                error: results.errors[0]?.error || 'ส่งไม่สำเร็จ',
                results,
            }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            type,
            count: usages.length,
            results,
        });
    } catch (error: any) {
        console.error('Error sending equipment usage test summary:', error);
        return NextResponse.json({
            success: false,
            error: parseLineError(error),
            status: error?.status || 500,
        }, { status: 500 });
    }
}
