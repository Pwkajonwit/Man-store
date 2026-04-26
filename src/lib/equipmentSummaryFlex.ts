export type EquipmentSummaryType = 'borrow' | 'return';

function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fmtDateTime(value: any) {
    const date = toDate(value);
    if (!date) return '-';

    return date.toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function isOverdue(value: any) {
    const date = toDate(value);
    return !!date && date.getTime() < Date.now();
}

function cleanText(value: any, fallback = '-') {
    const text = String(value || fallback)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/[\uD800-\uDFFF]/g, '')
        .trim();

    return text || fallback;
}

function truncate(value: any, maxLength = 42) {
    const text = cleanText(value);
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function metricBox(label: string, value: string, color: string) {
    return {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#F8FAFC',
        cornerRadius: 'md',
        paddingAll: 'md',
        flex: 1,
        contents: [
            {
                type: 'text',
                text: label,
                size: 'xxs',
                color: '#64748B',
                weight: 'bold',
            },
            {
                type: 'text',
                text: value,
                size: 'lg',
                color,
                weight: 'bold',
                margin: 'xs',
            },
        ],
    };
}

function detailLine(label: string, value: string, color = '#334155') {
    return {
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
            {
                type: 'text',
                text: label,
                size: 'xxs',
                color: '#94A3B8',
                flex: 2,
            },
            {
                type: 'text',
                text: value,
                size: 'xs',
                color,
                flex: 5,
                wrap: true,
            },
        ],
    };
}

function borrowItem(usage: any, index: number) {
    const overdue = isOverdue(usage.expectedReturnDate);
    const qty = `${usage.quantity || 1} ${usage.unit || 'ชิ้น'}`;

    return {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        paddingAll: 'md',
        backgroundColor: overdue ? '#FEF2F2' : '#FFFFFF',
        borderColor: overdue ? '#FCA5A5' : '#E2E8F0',
        borderWidth: '1px',
        cornerRadius: 'md',
        contents: [
            {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'text',
                        text: `${index + 1}. ${truncate(usage.equipmentName, 34)}`,
                        size: 'sm',
                        color: '#0F172A',
                        weight: 'bold',
                        flex: 1,
                        wrap: true,
                    },
                    {
                        type: 'text',
                        text: qty,
                        size: 'xs',
                        color: '#2563EB',
                        align: 'end',
                        flex: 0,
                    },
                ],
            },
            detailLine('ผู้ยืม', truncate(usage.userName, 40)),
            detailLine('ยืมเมื่อ', fmtDateTime(usage.borrowTime)),
            detailLine('กำหนดคืน', usage.expectedReturnDate ? fmtDateTime(usage.expectedReturnDate) : '-', overdue ? '#DC2626' : '#334155'),
        ],
    };
}

function returnItem(usage: any, index: number) {
    const qty = `${usage.returnQuantity || usage.quantity || 1} ${usage.unit || 'ชิ้น'}`;

    return {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        paddingAll: 'md',
        backgroundColor: '#FFFFFF',
        borderColor: '#D1FAE5',
        borderWidth: '1px',
        cornerRadius: 'md',
        contents: [
            {
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'text',
                        text: `${index + 1}. ${truncate(usage.equipmentName, 34)}`,
                        size: 'sm',
                        color: '#0F172A',
                        weight: 'bold',
                        flex: 1,
                        wrap: true,
                    },
                    {
                        type: 'text',
                        text: qty,
                        size: 'xs',
                        color: '#059669',
                        align: 'end',
                        flex: 0,
                    },
                ],
            },
            detailLine('ผู้คืน', truncate(usage.userName, 40)),
            detailLine('คืนเมื่อ', fmtDateTime(usage.returnTime)),
            usage.returnNote ? detailLine('หมายเหตุ', truncate(usage.returnNote, 60)) : null,
        ].filter(Boolean),
    };
}

export function equipmentSummaryFlex(type: EquipmentSummaryType, usages: any[], options: { title?: string; generatedAt?: any; pendingUsages?: any[] } = {}) {
    const total = usages.length;
    const visibleUsages = usages.slice(0, 8);
    const hiddenCount = Math.max(total - visibleUsages.length, 0);
    const pendingUsages = options.pendingUsages || [];
    const visiblePendingUsages = pendingUsages.slice(0, 5);
    const hiddenPendingCount = Math.max(pendingUsages.length - visiblePendingUsages.length, 0);
    const overdueCount = type === 'borrow'
        ? usages.filter((usage) => isOverdue(usage.expectedReturnDate)).length
        : pendingUsages.filter((usage) => isOverdue(usage.expectedReturnDate)).length;
    const accent = type === 'borrow' ? '#2563EB' : '#059669';
    const title = options.title || (type === 'borrow' ? 'สรุปรายการยืม' : 'สรุปการคืน');
    const itemBoxes: any[] = visibleUsages.map((usage, index) => type === 'borrow'
        ? borrowItem(usage, index)
        : returnItem(usage, index));

    if (itemBoxes.length === 0) {
        itemBoxes.push({
            type: 'box',
            layout: 'vertical',
            paddingAll: 'lg',
            backgroundColor: '#F8FAFC',
            cornerRadius: 'md',
            contents: [
                {
                    type: 'text',
                    text: type === 'borrow' ? 'ไม่มีรายการยืมที่ยังไม่คืน' : 'ยังไม่มีรายการคืนวันนี้',
                    size: 'sm',
                    color: '#64748B',
                    align: 'center',
                },
            ],
        });
    }

    if (hiddenCount > 0) {
        itemBoxes.push({
            type: 'text',
            text: `และอีก ${hiddenCount} รายการ`,
            size: 'xs',
            color: '#64748B',
            align: 'center',
            margin: 'md',
        });
    }

    const pendingBoxes: any[] = visiblePendingUsages.map((usage, index) => borrowItem(usage, index));
    if (hiddenPendingCount > 0) {
        pendingBoxes.push({
            type: 'text',
            text: `และอีก ${hiddenPendingCount} รายการ`,
            size: 'xs',
            color: '#64748B',
            align: 'center',
            margin: 'md',
        });
    }

    const pendingSection = type === 'return'
        ? [
            {
                type: 'separator',
                margin: 'xl',
                color: '#E2E8F0',
            },
            {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                spacing: 'sm',
                contents: [
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'text',
                                text: 'รายการที่ยังไม่คืน',
                                size: 'sm',
                                color: '#0F172A',
                                weight: 'bold',
                                flex: 1,
                            },
                            {
                                type: 'text',
                                text: `${pendingUsages.length} รายการ`,
                                size: 'xs',
                                color: pendingUsages.length > 0 ? '#DC2626' : '#059669',
                                align: 'end',
                            },
                        ],
                    },
                    ...(pendingBoxes.length > 0
                        ? pendingBoxes
                        : [{
                            type: 'box',
                            layout: 'vertical',
                            paddingAll: 'lg',
                            backgroundColor: '#F8FAFC',
                            cornerRadius: 'md',
                            contents: [{
                                type: 'text',
                                text: 'ไม่มีรายการค้างคืน',
                                size: 'sm',
                                color: '#64748B',
                                align: 'center',
                            }],
                        }]),
                ],
            },
        ]
        : [];

    return {
        altText: title,
        contents: {
            type: 'bubble',
            size: 'mega',
            body: {
                type: 'box',
                layout: 'vertical',
                paddingAll: 'xl',
                backgroundColor: '#FFFFFF',
                contents: [
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'box',
                                layout: 'vertical',
                                flex: 1,
                                contents: [
                                    {
                                        type: 'text',
                                        text: title,
                                        size: 'lg',
                                        weight: 'bold',
                                        color: '#0F172A',
                                        wrap: true,
                                    },
                                    {
                                        type: 'text',
                                        text: fmtDateTime(options.generatedAt || new Date()),
                                        size: 'xs',
                                        color: '#64748B',
                                        margin: 'xs',
                                    },
                                ],
                            },
                            {
                                type: 'box',
                                layout: 'vertical',
                                backgroundColor: type === 'borrow' ? '#DBEAFE' : '#D1FAE5',
                                cornerRadius: 'xxl',
                                paddingAll: 'sm',
                                justifyContent: 'center',
                                contents: [
                                    {
                                        type: 'text',
                                        text: type === 'borrow' ? 'BORROW' : 'RETURN',
                                        size: 'xxs',
                                        color: accent,
                                        weight: 'bold',
                                        align: 'center',
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        spacing: 'md',
                        margin: 'lg',
                        contents: type === 'borrow'
                            ? [
                                metricBox('ทั้งหมด', String(total), accent),
                                metricBox('เกินกำหนด', String(overdueCount), overdueCount > 0 ? '#DC2626' : '#059669'),
                            ]
                            : [
                                metricBox('คืนวันนี้', String(total), accent),
                                metricBox('ยังไม่คืน', String(pendingUsages.length), pendingUsages.length > 0 ? '#DC2626' : '#059669'),
                            ],
                    },
                    {
                        type: 'separator',
                        margin: 'lg',
                        color: '#E2E8F0',
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'sm',
                        margin: 'lg',
                        contents: itemBoxes,
                    },
                    ...pendingSection,
                ],
            },
        },
    };
}
