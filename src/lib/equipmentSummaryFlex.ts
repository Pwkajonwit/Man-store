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
    const qty = `${usage.quantity || 1}${usage.unit || 'ชิ้น'}`;
    const eqName = truncate(usage.equipmentName, 25);
    const userName = truncate(usage.userName, 15);

    return {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        margin: 'xs',
        contents: [
            {
                type: 'text',
                text: `${index + 1}.`,
                size: 'xs',
                color: '#64748B',
                flex: 0,
                wrap: false,
            },
            {
                type: 'text',
                text: `${eqName} (${qty})`,
                size: 'sm',
                color: overdue ? '#DC2626' : '#0F172A',
                flex: 1,
                wrap: true,
                weight: overdue ? 'bold' : 'regular',
            },
            {
                type: 'text',
                text: userName,
                size: 'sm',
                color: overdue ? '#DC2626' : '#64748B',
                flex: 0,
                align: 'end',
                wrap: false,
                weight: overdue ? 'bold' : 'regular',
            }
        ],
    };
}

function returnItem(usage: any, index: number) {
    const qty = `${usage.returnQuantity || usage.quantity || 1}${usage.unit || 'ชิ้น'}`;
    const eqName = truncate(usage.equipmentName, 25);
    const userName = truncate(usage.userName, 15);

    return {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        margin: 'xs',
        contents: [
            {
                type: 'text',
                text: `${index + 1}.`,
                size: 'xs',
                color: '#64748B',
                flex: 0,
                wrap: false,
            },
            {
                type: 'text',
                text: `${eqName} (${qty})`,
                size: 'sm',
                color: '#059669',
                flex: 1,
                wrap: true,
            },
            {
                type: 'text',
                text: userName,
                size: 'sm',
                color: '#64748B',
                flex: 0,
                align: 'end',
                wrap: false,
            }
        ],
    };
}

function createBubble(
    type: EquipmentSummaryType,
    title: string,
    generatedAt: any,
    total: number,
    overdueCount: number,
    pendingCount: number,
    itemBoxes: any[],
    pendingSection: any[],
    accent: string,
    pageText: string
) {
    return {
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
                                    text: fmtDateTime(generatedAt || new Date()),
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
                                    text: pageText,
                                    size: 'xs',
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
                            metricBox('ยังไม่คืน', String(pendingCount), pendingCount > 0 ? '#DC2626' : '#059669'),
                        ],
                },
                {
                    type: 'separator',
                    margin: 'lg',
                    color: '#E2E8F0',
                },
                ...(itemBoxes.length > 0 ? [{
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    margin: 'lg',
                    contents: itemBoxes,
                }] : []),
                ...pendingSection,
            ],
        },
    };
}

export function equipmentSummaryFlex(type: EquipmentSummaryType, usages: any[], options: { title?: string; generatedAt?: any; pendingUsages?: any[] } = {}) {
    const total = usages.length;
    const pendingUsages = options.pendingUsages || [];
    const overdueCount = type === 'borrow'
        ? usages.filter((usage) => isOverdue(usage.expectedReturnDate)).length
        : pendingUsages.filter((usage) => isOverdue(usage.expectedReturnDate)).length;
    const accent = type === 'borrow' ? '#2563EB' : '#059669';
    const baseTitle = options.title || (type === 'borrow' ? 'สรุปรายการยืม' : 'สรุปการคืน');

    const ITEMS_PER_PAGE = 10;
    const bubblesData: { usages: any[]; pending: any[] }[] = [];

    let uIdx = 0;
    let pIdx = 0;

    if (usages.length === 0 && pendingUsages.length === 0) {
        bubblesData.push({ usages: [], pending: [] });
    } else {
        while (uIdx < usages.length || pIdx < pendingUsages.length) {
            const currentUsages = [];
            const currentPending = [];
            let spaceLeft = ITEMS_PER_PAGE;

            while (uIdx < usages.length && spaceLeft > 0) {
                currentUsages.push({ item: usages[uIdx], globalIndex: uIdx });
                uIdx++;
                spaceLeft--;
            }

            if (type === 'return') {
                while (pIdx < pendingUsages.length && spaceLeft > 0) {
                    currentPending.push({ item: pendingUsages[pIdx], globalIndex: pIdx });
                    pIdx++;
                    spaceLeft--;
                }
            } else {
                pIdx = pendingUsages.length;
            }

            bubblesData.push({ usages: currentUsages, pending: currentPending });
        }
    }

    const bubbles = bubblesData.map((data, pageIndex) => {
        const itemBoxes: any[] = data.usages.map((u) => type === 'borrow'
            ? borrowItem(u.item, u.globalIndex)
            : returnItem(u.item, u.globalIndex));

        if (itemBoxes.length === 0 && data.usages.length === 0 && pageIndex === 0) {
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

        let pendingSection: any[] = [];
        if (type === 'return') {
            const pendingBoxes: any[] = data.pending.map((p) => borrowItem(p.item, p.globalIndex));
            const showEmptyPending = pageIndex === 0 && pendingUsages.length === 0;
            const hasPendingInBubble = pendingBoxes.length > 0;

            if (hasPendingInBubble || showEmptyPending) {
                pendingSection = [
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
                ];
            }
        }

        const pageText = `${pageIndex + 1}/${bubblesData.length}`;
        return createBubble(type, baseTitle, options.generatedAt, total, overdueCount, pendingUsages.length, itemBoxes, pendingSection, accent, pageText);
    });

    const limitedBubbles = bubbles.slice(0, 12);

    return {
        altText: baseTitle,
        contents: limitedBubbles.length > 1
            ? { type: 'carousel', contents: limitedBubbles }
            : limitedBubbles[0],
    };
}
