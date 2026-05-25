type FlexLike = Record<string, any>;

const FALLBACK_TEXT = "-";

function sanitizeFlexNode(value: any): any {
    if (value === undefined || value === null) return undefined;

    if (Array.isArray(value)) {
        return value
            .map(sanitizeFlexNode)
            .filter((item) => item !== undefined && item !== null);
    }

    if (typeof value !== "object") return value;

    const sanitized: FlexLike = {};

    for (const [key, childValue] of Object.entries(value)) {
        const nextValue = sanitizeFlexNode(childValue);
        if (nextValue !== undefined && nextValue !== null) {
            sanitized[key] = nextValue;
        }
    }

    if (sanitized.type === "text") {
        const text = String(sanitized.text ?? "").trim();
        sanitized.text = text || FALLBACK_TEXT;
    }

    if (sanitized.type === "box" && Array.isArray(sanitized.contents) && sanitized.contents.length === 0) {
        sanitized.contents = [{ type: "spacer", size: "xs" }];
    }

    return sanitized;
}

export function sanitizeFlexMessage<T extends { altText?: string; contents?: any }>(flexMessage: T): T {
    return {
        ...flexMessage,
        altText: String(flexMessage.altText || "LINE message").trim().slice(0, 400) || "LINE message",
        contents: sanitizeFlexNode(flexMessage.contents),
    };
}

type UsageFlexRow = {
    name?: string;
    quantity?: number | string;
    unit?: string;
    detail?: string;
};

type UsageFlexOptions = {
    title: string;
    subtitle?: string;
    metaLines?: string[];
    rows: UsageFlexRow[];
    footer?: string;
};

const safeText = (value?: string | number) => {
    const text = String(value ?? "").trim();
    return text || FALLBACK_TEXT;
};

export function buildUsageNotificationFlex(options: UsageFlexOptions) {
    const rows = options.rows.length > 0 ? options.rows : [{ name: "ไม่มีรายการ" }];
    const metaLines = (options.metaLines || []).map((line) => safeText(line)).filter((line) => line !== FALLBACK_TEXT);

    return sanitizeFlexMessage({
        altText: safeText(options.title),
        contents: {
            type: "bubble",
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    {
                        type: "text",
                        text: safeText(options.title),
                        weight: "bold",
                        size: "md",
                        color: "#111827",
                        wrap: true,
                    },
                    ...(options.subtitle ? [{
                        type: "text",
                        text: safeText(options.subtitle),
                        size: "sm",
                        color: "#6B7280",
                        wrap: true,
                    }] : []),
                    ...metaLines.map((line) => ({
                        type: "text",
                        text: line,
                        size: "xs",
                        color: "#B45309",
                        wrap: true,
                    })),
                    {
                        type: "separator",
                        margin: "md",
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        spacing: "sm",
                        contents: rows.map((row) => ({
                            type: "box",
                            layout: "vertical",
                            spacing: "xs",
                            contents: [
                                {
                                    type: "box",
                                    layout: "horizontal",
                                    contents: [
                                        {
                                            type: "text",
                                            text: safeText(row.name),
                                            size: "sm",
                                            color: "#111827",
                                            wrap: true,
                                            flex: 5,
                                        },
                                        {
                                            type: "text",
                                            text: `${safeText(row.quantity)} ${safeText(row.unit)}`,
                                            size: "sm",
                                            color: "#0F766E",
                                            align: "end",
                                            flex: 2,
                                            wrap: true,
                                        },
                                    ],
                                },
                                ...(row.detail ? [{
                                    type: "text",
                                    text: safeText(row.detail),
                                    size: "xxs",
                                    color: "#B45309",
                                    wrap: true,
                                }] : []),
                            ],
                        })),
                    },
                    ...(options.footer ? [
                        {
                            type: "separator",
                            margin: "md",
                        },
                        {
                            type: "text",
                            text: safeText(options.footer),
                            size: "xs",
                            color: "#9CA3AF",
                            align: "end",
                            wrap: true,
                        },
                    ] : []),
                ],
            },
        },
    });
}
