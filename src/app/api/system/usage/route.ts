import admin from "@/lib/firebaseAdmin";
const CACHE_TTL_MINUTES = 15; // cache bucket totals for 15 minutes

export async function GET() {
    try {
        const db = admin.firestore();

        async function countCollection(name: string) {
            try {
                if (typeof (db.collection(name) as any).count === 'function') {
                    const snap = await (db.collection(name) as any).count().get();
                    const data = snap.data && typeof snap.data === 'function' ? snap.data() : undefined;
                    if (data && typeof data.count === 'number') return data.count;
                }
            } catch (_) { }
            const snapAll = await db.collection(name).select().get();
            return snapAll.size;
        }

        const [vehicles, bookings, expenses, usages, users] = await Promise.all([
            countCollection('vehicles'),
            countCollection('bookings'),
            countCollection('expenses'),
            countCollection('vehicle-usage'),
            countCollection('users')
        ]);

        let vehicleImagesCount = 0;
        let vehicleImagesBytes = 0;
        let bucketTotalCount = 0;
        let bucketTotalBytes = 0;
        try {
            const storage = admin.storage();
            // @ts-ignore
            const [files] = await storage.bucket().getFiles({ prefix: 'vehicle_images/' });
            if (Array.isArray(files)) {
                vehicleImagesCount = files.length;
                try {
                    const metas = await Promise.all(
                        files.map((f: any) => f.getMetadata().then((r: any) => r[0]).catch(() => null))
                    );
                    vehicleImagesBytes = metas.filter(Boolean).reduce((sum: number, m: any) => sum + (Number(m.size) || 0), 0);
                } catch (_) { }
            }
        } catch (_) { }

        const projectId = process.env.FIREBASE_PROJECT_ID || admin.app().options.projectId || null;

        // Try to read bucket totals from cache in Firestore
        try {
            const cacheRef = db.collection('appConfig').doc('systemUsageCache');
            const cacheSnap = await cacheRef.get();
            let useCache = false;
            if (cacheSnap.exists) {
                const cached = cacheSnap.data();
                if (cached?.updatedAt && cached.updatedAt.toDate) {
                    const ageMs = Date.now() - cached.updatedAt.toDate().getTime();
                    const ageMinutes = ageMs / (1000 * 60);
                    if (ageMinutes <= CACHE_TTL_MINUTES) useCache = true;
                }
            }
            if (useCache) {
                const cached = cacheSnap.data();
                if (cached) {
                    bucketTotalCount = cached.bucketTotalCount || 0;
                    bucketTotalBytes = cached.bucketTotalBytes || 0;
                }
            } else {
                // compute bucket totals with pagination
                try {
                    // @ts-ignore
                    const bucket = admin.storage().bucket();
                    let pageToken = undefined;
                    let allFilesCount = 0;
                    let allFilesBytes = 0;
                    do {
                        const [files, nextQuery]: any = await bucket.getFiles({ pageToken });
                        if (!Array.isArray(files) || files.length === 0) break;
                        const metas = await Promise.all(files.map((f: any) => f.getMetadata().then((r: any) => r[0]).catch(() => null)));
                        for (const m of metas) {
                            if (!m) continue;
                            allFilesCount += 1;
                            allFilesBytes += Number(m.size) || 0;
                        }
                        pageToken = nextQuery?.pageToken;
                    } while (pageToken);
                    bucketTotalCount = allFilesCount;
                    bucketTotalBytes = allFilesBytes;
                    // Save to cache
                    try {
                        await cacheRef.set({ bucketTotalCount, bucketTotalBytes, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    } catch (_) { }
                } catch (err) {
                    // ignore bucket errors and return prefix-only
                }
            }
        } catch (_) { }

        return Response.json({
            projectId,
            firestore: { vehicles, bookings, expenses, usages, users },
            storage: { vehicleImagesCount, vehicleImagesBytes, bucketTotalCount, bucketTotalBytes }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'internal_error' }), { status: 500 });
    }
}
