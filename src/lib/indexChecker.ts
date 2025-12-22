import { collection, query, where, orderBy, getDocs, limit, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * List of all queries that require composite indexes in this app
 */
const REQUIRED_QUERIES = [
    {
        name: "อุปกรณ์ที่กำลังยืมของผู้ใช้",
        collection: "equipment-usage",
        description: "userId + status + type",
        buildQuery: () => {
            if (!db) return null;
            return query(
                collection(db as any, "equipment-usage"),
                where("userId", "==", "__test__"),
                where("status", "==", "active"),
                where("type", "==", "borrow"),
                limit(1)
            )
        }
    },
    {
        name: "รายการกำลังยืมทั้งหมด",
        collection: "equipment-usage",
        description: "status + type",
        buildQuery: () => {
            if (!db) return null;
            return query(
                collection(db as any, "equipment-usage"),
                where("status", "==", "active"),
                where("type", "==", "borrow"),
                limit(1)
            )
        }
    },
    {
        name: "ประวัติการยืม-เบิกเรียงตามวันที่",
        collection: "equipment-usage",
        description: "borrowTime (desc)",
        buildQuery: () => {
            if (!db) return null;
            return query(
                collection(db as any, "equipment-usage"),
                orderBy("borrowTime", "desc"),
                limit(1)
            )
        }
    },
    {
        name: "รายการซ่อมเรียงตามวันที่",
        collection: "repairs",
        description: "createdAt (desc)",
        buildQuery: () => {
            if (!db) return null;
            return query(
                collection(db as any, "repairs"),
                orderBy("createdAt", "desc"),
                limit(1)
            )
        }
    },
    {
        name: "รายการแจ้งซ่อมของผู้ใช้",
        collection: "repair-reports",
        description: "reportedBy + createdAt (desc)",
        buildQuery: () => {
            if (!db) return null;
            return query(
                collection(db as any, "repair-reports"),
                where("reportedBy", "==", "__test__"),
                orderBy("createdAt", "desc"),
                limit(1)
            )
        }
    },
    {
        name: "ประวัติการยืมเบิกของอุปกรณ์เฉพาะตัว",
        collection: "equipment-usage",
        description: "equipmentId + borrowTime (desc)",
        buildQuery: () => {
            if (!db) return null;
            return query(
                collection(db as any, "equipment-usage"),
                where("equipmentId", "==", "__test__"),
                orderBy("borrowTime", "desc"),
                limit(1)
            )
        }
    },
    {
        name: "รายชื่อพนักงานเรียงตามชื่อ",
        collection: "users",
        description: "name (asc)",
        buildQuery: () => {
            if (!db) return null;
            return query(
                collection(db as any, "users"),
                orderBy("name", "asc"),
                limit(1)
            )
        }
    },
];

/**
 * Extract index creation URL from Firebase error message
 */
function extractIndexUrl(errorMessage: string) {
    const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    return urlMatch ? urlMatch[0] : undefined;
}

export interface IndexCheckResult {
    queryName: string;
    collection: string;
    description: string;
    status: "ok" | "missing";
    indexUrl?: string;
    error?: string;
}

/**
 * Check all required indexes and return results
 */
export async function checkAllIndexes(): Promise<IndexCheckResult[]> {
    const results: IndexCheckResult[] = [];

    for (const queryDef of REQUIRED_QUERIES) {
        try {
            const q = queryDef.buildQuery();
            if (!q) {
                results.push({
                    queryName: queryDef.name,
                    collection: queryDef.collection,
                    description: queryDef.description,
                    status: "ok" // Skip if db not ready
                });
                continue;
            }
            await getDocs(q);

            results.push({
                queryName: queryDef.name,
                collection: queryDef.collection,
                description: queryDef.description,
                status: "ok"
            });
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            const indexUrl = extractIndexUrl(errorMessage);

            if (indexUrl || errorMessage.includes("index")) {
                results.push({
                    queryName: queryDef.name,
                    collection: queryDef.collection,
                    description: queryDef.description,
                    status: "missing",
                    indexUrl: indexUrl,
                    error: "ต้องสร้าง Index"
                });
            } else {
                // Other errors (e.g., permission denied) - likely OK
                results.push({
                    queryName: queryDef.name,
                    collection: queryDef.collection,
                    description: queryDef.description,
                    status: "ok"
                });
            }
        }
    }

    return results;
}

/**
 * Get only missing indexes
 */
export async function getMissingIndexes() {
    const results = await checkAllIndexes();
    return results.filter(r => r.status === "missing");
}
