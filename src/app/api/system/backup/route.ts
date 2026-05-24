import { NextResponse } from "next/server";
import admin from "@/lib/firebaseAdmin";

const BACKUP_COLLECTIONS = [
    "settings",
    "equipment",
    "equipment-usage",
    "stock-history",
    "repairs",
    "repair-reports",
    "users",
    "appConfig",
    "scheduled-notification-logs",
    "bookings",
    "expenses",
    "vehicles",
    "vehicle-usage",
];

const CSV_HEADERS = ["collection", "id", "data"];

function csvEscape(value: unknown): string {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            inQuotes = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else if (char !== "\r") {
            field += char;
        }
    }

    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((items) => items.some((item) => item.trim() !== ""));
}

function restoreFirestoreValues(value: any): any {
    if (Array.isArray(value)) {
        return value.map(restoreFirestoreValues);
    }

    if (value && typeof value === "object") {
        const seconds = value._seconds ?? value.seconds;
        const nanoseconds = value._nanoseconds ?? value.nanoseconds;
        const keys = Object.keys(value);

        if (
            typeof seconds === "number" &&
            typeof nanoseconds === "number" &&
            keys.every((key) => ["_seconds", "_nanoseconds", "seconds", "nanoseconds"].includes(key))
        ) {
            return new admin.firestore.Timestamp(seconds, nanoseconds);
        }

        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, restoreFirestoreValues(item)])
        );
    }

    return value;
}

export async function GET() {
    try {
        const db = admin.firestore();
        const rows = [CSV_HEADERS.map(csvEscape).join(",")];

        for (const collectionName of BACKUP_COLLECTIONS) {
            const snapshot = await db.collection(collectionName).get();
            snapshot.docs.forEach((doc) => {
                rows.push([
                    csvEscape(collectionName),
                    csvEscape(doc.id),
                    csvEscape(JSON.stringify(doc.data())),
                ].join(","));
            });
        }

        const csv = `\uFEFF${rows.join("\r\n")}`;
        const dateKey = new Date().toISOString().slice(0, 10);

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="store-backup-${dateKey}.csv"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Error exporting backup:", error);
        return NextResponse.json({ error: "Export backup failed" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const mode = formData.get("mode") === "overwrite" ? "overwrite" : "merge";

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
        }

        const text = await file.text();
        const rows = parseCsv(text.replace(/^\uFEFF/, ""));
        const [headers, ...items] = rows;

        if (!headers || headers.join(",") !== CSV_HEADERS.join(",")) {
            return NextResponse.json(
                { error: `Invalid CSV headers. Expected: ${CSV_HEADERS.join(",")}` },
                { status: 400 }
            );
        }

        const db = admin.firestore();
        let batch = db.batch();
        let pending = 0;
        let imported = 0;

        for (const row of items) {
            const [collectionName, id, dataJson] = row;

            if (!BACKUP_COLLECTIONS.includes(collectionName) || !id || !dataJson) {
                continue;
            }

            const data = restoreFirestoreValues(JSON.parse(dataJson));
            const ref = db.collection(collectionName).doc(id);

            if (mode === "overwrite") {
                batch.set(ref, data);
            } else {
                batch.set(ref, data, { merge: true });
            }

            pending++;
            imported++;

            if (pending >= 450) {
                await batch.commit();
                batch = db.batch();
                pending = 0;
            }
        }

        if (pending > 0) {
            await batch.commit();
        }

        return NextResponse.json({ success: true, imported, mode });
    } catch (error) {
        console.error("Error importing backup:", error);
        return NextResponse.json({ error: "Import backup failed" }, { status: 500 });
    }
}
