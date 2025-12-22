import admin from '@/lib/firebaseAdmin';
import { bookingCreatedFlex, vehicleSentFlex, vehicleBorrowedFlex, vehicleReturnedFlex } from './lineFlexMessages';

const db = admin.firestore();
const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.NEXT_PUBLIC_LINE_CHANNEL_ACCESS_TOKEN || '';

function normalizeBooking(b: any) {
    if (!b) return null;

    console.log('normalizeBooking - input totalExpenses:', b.totalExpenses, 'type:', typeof b.totalExpenses);
    console.log('normalizeBooking - input expenses:', b.expenses);

    const normalized = {
        id: b.id || b.bookingId || b._id || '',
        requesterName: b.requesterName || b.requester || b.userName || '',
        userEmail: b.userEmail || b.requesterEmail || b.requester?.email || '',
        // who created the booking (requester)
        userId: b.userId || b.requesterId || null,
        // who will drive / who was assigned
        driverId: b.driverId || b.driver?.id || b.driverUid || null,
        driverName: b.driverName || b.driver?.name || b.driver?.displayName || null,
        vehicleLicensePlate: b.vehicleLicensePlate || b.vehicle?.licensePlate || b.vehicleId || '',
        // Canonical fields introduced: startDateTime (instant), startCalendarDate (YYYY-MM-DD)
        startDateTime: b.startDateTime || b.startDate || b.from || null,
        startCalendarDate: b.startCalendarDate || b.startDate || null,
        // end may be stored as endDateTime or endDate
        endDateTime: b.endDateTime || b.endDate || b.to || null,
        endCalendarDate: b.endCalendarDate || b.endDate || null,
        // timestamps / lifecycle
        sentAt: b.sentAt || null,
        returnedAt: b.returnedAt || b.endDateTime || null,
        // usage data fields
        startTime: b.startTime || null,
        endTime: b.endTime || null,
        destination: b.destination || null,
        purpose: b.purpose || null,
        totalDistance: b.totalDistance !== undefined ? b.totalDistance : null,
        // mileage and expenses (may be attached when server fetched full booking)
        startMileage: b.startMileage || null,
        endMileage: b.endMileage || null,
        totalExpenses: typeof b.totalExpenses === 'number' ? b.totalExpenses : 0,
        expenses: Array.isArray(b.expenses) ? b.expenses : []
    };

    console.log('normalizeBooking - output totalExpenses:', normalized.totalExpenses);
    console.log('normalizeBooking - output expenses:', normalized.expenses);

    return normalized;
}

async function sendPushMessage(to: string, message: any) {
    if (!ACCESS_TOKEN) throw new Error('LINE channel access token not configured');
    let payload: any[];
    if (Array.isArray(message)) {
        payload = message.map(m => {
            if (m.contents) return { type: 'flex', altText: m.altText || '', contents: m.contents };
            if (m.text || m.altText) return { type: 'text', text: m.text || m.altText || '' };
            return m;
        });
    } else if (message.contents) {
        payload = [{ type: 'flex', altText: message.altText || '', contents: message.contents }];
    } else if (message.text || message.altText) {
        payload = [{ type: 'text', text: message.text || message.altText || '' }];
    } else {
        payload = [message];
    }
    const body = { to, messages: payload };
    const resp = await fetch(LINE_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
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

export async function sendNotificationsForEvent(event: string, booking: any) {
    // If caller provided only a booking id or partial booking data, fetch
    // the authoritative booking record and related expenses from Firestore
    // so notifications can include server-side timestamps, mileage and totals.
    let fullBooking = booking || {};

    // Store original expenses and totalExpenses if provided (for vehicle_returned/vehicle_borrowed)
    const hasExpensesData = booking && (typeof booking.totalExpenses === 'number' || Array.isArray(booking.expenses));

    try {
        if (booking && booking.id && !hasExpensesData) {
            const snap = await db.collection('bookings').doc(booking.id).get();
            if (snap.exists) {
                fullBooking = { ...(booking || {}), ...snap.data(), id: booking.id };
            }
            try {
                const expSnap = await db.collection('expenses').where('bookingId', '==', booking.id).get();
                const exps = expSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
                fullBooking.expenses = exps;
                fullBooking.totalExpenses = exps.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
            } catch (e) {
                console.warn('Failed to load expenses for booking', booking.id, e);
            }
        }
    } catch (e) {
        console.warn('Failed to load full booking record for notifications, proceeding with provided payload', e);
    }

    console.log('sendNotificationsForEvent - fullBooking before normalize:', { totalExpenses: fullBooking.totalExpenses, expensesCount: fullBooking.expenses?.length });

    const b = normalizeBooking(fullBooking);
    // Load settings
    let notifSettings: any = { roles: {} };
    try {
        const cfgSnap = await db.collection('appConfig').doc('notifications').get();
        if (cfgSnap.exists) notifSettings = cfgSnap.data();
    } catch (e) {
        console.error('Failed to load notification settings, using defaults', e);
    }

    // Quick fail if no LINE token configured
    if (!ACCESS_TOKEN) {
        console.error('LINE_CHANNEL_ACCESS_TOKEN not configured — skipping sends');
        const res: any = { sent: [], skipped: [], errors: [{ reason: 'no_access_token' }] };
        return res;
    }

    // Build templates (only booking_created and vehicle_sent)
    const templates: any = {
        admin: {
            booking_created: bookingCreatedFlex(b),
            vehicle_sent: vehicleSentFlex(b),
            vehicle_borrowed: null,  // Will be set from usage data
            vehicle_returned: null   // Will be set from usage data
        },
        driver: {
            booking_created: bookingCreatedFlex(b),
            vehicle_sent: vehicleSentFlex(b),
            vehicle_borrowed: null,
            vehicle_returned: null
        },
        employee: {
            booking_created: bookingCreatedFlex(b),
            vehicle_sent: vehicleSentFlex(b),
            vehicle_borrowed: null,
            vehicle_returned: null
        }
    };

    const results: any = { sent: [], skipped: [], errors: [] };

    // Collect issues for optional admin alert
    const issues: any[] = [];

    // Build recipient list based on event type
    let recipientDocs: FirebaseFirestore.DocumentSnapshot[] = [];
    try {
        if (event === 'booking_created') {
            // For booking_created: notify only admins + the requester
            const adminSnaps = await db.collection('users').where('role', '==', 'admin').get();
            recipientDocs.push(...adminSnaps.docs);

            // Add the requester (person who created the booking)
            const requesterId = fullBooking.userId || fullBooking.requesterId;
            if (requesterId) {
                try {
                    const requesterDoc = await db.collection('users').doc(requesterId).get();
                    if (requesterDoc.exists) recipientDocs.push(requesterDoc);
                } catch (e) {
                    console.warn('Failed to fetch requester user for notifications', requesterId, e);
                }
            }
        } else if (event === 'vehicle_borrowed') {
            // For vehicle_borrowed: notify admins only (borrower will get direct notification)
            const adminSnaps = await db.collection('users').where('role', '==', 'admin').get();
            recipientDocs.push(...adminSnaps.docs);

            // Set templates for vehicle_borrowed using usage data
            const usageDataBorrowed = b; // Use normalized booking data
            console.log('vehicle_borrowed - usageData:', usageDataBorrowed);
            templates.admin.vehicle_borrowed = vehicleBorrowedFlex(usageDataBorrowed);
            templates.driver.vehicle_borrowed = vehicleBorrowedFlex(usageDataBorrowed);
            templates.employee.vehicle_borrowed = vehicleBorrowedFlex(usageDataBorrowed);
        } else if (event === 'vehicle_returned') {
            // For vehicle_returned: notify admins only (returning user will get direct notification)
            const adminSnaps = await db.collection('users').where('role', '==', 'admin').get();
            recipientDocs.push(...adminSnaps.docs);

            // Set templates for vehicle_returned using usage data
            const usageDataReturned = b; // Use normalized booking data
            console.log('vehicle_returned - usageData:', usageDataReturned);
            templates.admin.vehicle_returned = vehicleReturnedFlex(usageDataReturned);
            templates.driver.vehicle_returned = vehicleReturnedFlex(usageDataReturned);
            templates.employee.vehicle_returned = vehicleReturnedFlex(usageDataReturned);
        } else if (event === 'booking_approved' || event === 'booking_rejected') {
            // For approval/rejection: notify admins + the requester
            const adminSnaps = await db.collection('users').where('role', '==', 'admin').get();
            recipientDocs.push(...adminSnaps.docs);

            const requesterId = fullBooking.userId || fullBooking.requesterId;
            if (requesterId) {
                try {
                    const requesterDoc = await db.collection('users').doc(requesterId).get();
                    if (requesterDoc.exists) recipientDocs.push(requesterDoc);
                } catch (e) {
                    console.warn('Failed to fetch requester user for notifications', requesterId, e);
                }
            }
        } else if (event === 'vehicle_sent') {
            // For vehicle_sent: notify admins + assigned driver + requester
            const adminSnaps = await db.collection('users').where('role', '==', 'admin').get();
            recipientDocs.push(...adminSnaps.docs);

            // Add driver
            if (fullBooking && fullBooking.driverId) {
                try {
                    const drv = await db.collection('users').doc(fullBooking.driverId).get();
                    if (drv.exists) recipientDocs.push(drv);
                } catch (e) {
                    console.warn('Failed to fetch driver user for notifications', fullBooking.driverId, e);
                }
            }

            // Add requester
            const requesterId = fullBooking.userId || fullBooking.requesterId;
            if (requesterId) {
                try {
                    const requesterDoc = await db.collection('users').doc(requesterId).get();
                    if (requesterDoc.exists) recipientDocs.push(requesterDoc);
                } catch (e) {
                    console.warn('Failed to fetch requester user for notifications', requesterId, e);
                }
            }
        } else {
            // For other events: notify all users (fallback to original behavior)
            const usersSnapshot = await db.collection('users').where('role', 'in', ['admin', 'employee', 'driver']).get();
            recipientDocs.push(...usersSnapshot.docs);
        }
    } catch (e) {
        console.error('Error querying users for notifications', e);
        throw e;
    }

    // ส่งแจ้งเตือนไปหาผู้ใช้รถ/ผู้ยืมรถโดยตรงก่อน (ตรวจสอบ role settings)
    const directNotifyUserId = fullBooking?.userId;
    console.log(`🔍 Direct notification check: userId=${directNotifyUserId}, event=${event}`);

    if (directNotifyUserId && (event === 'vehicle_borrowed' || event === 'vehicle_returned')) {
        console.log(`📤 Attempting direct notification to userId=${directNotifyUserId} for ${event}`);
        try {
            // userId อาจเป็น LINE ID หรือ Firestore document ID ลองทั้งสองวิธี
            let userDoc = await db.collection('users').doc(directNotifyUserId).get();
            let userData = null;
            let userDocId = directNotifyUserId;

            if (userDoc.exists) {
                userData = userDoc.data();
                console.log(`👤 Found user by document ID: ${directNotifyUserId}`);
            } else {
                // ถ้าไม่เจอ ให้ลอง query by lineId
                console.log(`🔎 Not found by doc ID, trying lineId query...`);
                const userQuery = await db.collection('users').where('lineId', '==', directNotifyUserId).limit(1).get();
                if (!userQuery.empty) {
                    userDoc = userQuery.docs[0];
                    userData = userDoc.data();
                    userDocId = userDoc.id;
                    console.log(`👤 Found user by lineId: docId=${userDocId}, lineId=${directNotifyUserId}`);
                }
            }

            if (userData) {
                const userLineId = userData?.lineId || directNotifyUserId; // fallback to directNotifyUserId if it's the LINE ID
                const userRole = userData?.role || 'driver';

                console.log(`👤 User details: lineId=${userLineId}, role=${userRole}`);

                // ตรวจสอบ settings ของ role นี้ว่าเปิดการแจ้งเตือนหรือไม่
                const roleSettings = (notifSettings.roles && notifSettings.roles[userRole]) || {};
                const enabled = typeof roleSettings[event] === 'boolean' ? roleSettings[event] : true;

                console.log(`🔔 Notification enabled for role ${userRole}: ${enabled}`);

                if (!enabled) {
                    console.log(`⏭️ Skipping direct notification - ${userRole} has disabled ${event} notifications`);
                    results.skipped.push({ uid: userDocId, reason: 'setting_disabled_direct', role: userRole });
                } else if (userLineId) {
                    // ใช้ template ตาม role ของผู้ใช้ หรือ fallback เป็น driver
                    const msgToSend = templates[userRole]?.[event] || templates.driver?.[event];

                    console.log(`📝 Message template exists: ${!!msgToSend}`);

                    if (msgToSend) {
                        try {
                            const messages = [{ type: 'flex', altText: msgToSend.altText || '', contents: msgToSend.contents }];
                            await sendPushMessage(userLineId, messages);
                            results.sent.push({ uid: userDocId, lineId: userLineId, direct: true });
                            console.log(`✅ Sent direct notification to userId=${userDocId} lineId=${userLineId} (${event})`);
                        } catch (err: any) {
                            console.error('❌ Error sending direct notification to user', userDocId, err);
                            const errBody = err && err.body ? err.body : String(err);
                            results.errors.push({ uid: userDocId, lineId: userLineId, error: errBody, direct: true });
                        }
                    } else {
                        console.warn(`⚠️ No message template for direct notification to user role=${userRole} event=${event}`);
                    }
                } else {
                    console.warn(`⚠️ User ${userDocId} has no lineId for direct notification`);
                }
            } else {
                console.warn(`⚠️ User ${directNotifyUserId} not found in database (tried both doc ID and lineId)`);
            }
        } catch (err) {
            console.error('❌ Error sending direct notification to userId', directNotifyUserId, err);
        }
    }

    // dedupe recipients by uid
    const seen = new Set();
    // เพิ่ม userId ที่ส่งไปแล้วใน seen เพื่อไม่ส่งซ้ำ
    if (directNotifyUserId) seen.add(directNotifyUserId);

    for (const doc of recipientDocs) {
        const ud = doc.data();
        const lineId = ud?.lineId;
        const role = ud?.role;
        const uid = doc.id;
        if (seen.has(uid)) continue;
        seen.add(uid);
        if (!['admin', 'employee', 'driver'].includes(role)) continue;
        const roleSettings = (notifSettings.roles && notifSettings.roles[role]) || {};
        const enabled = typeof roleSettings[event] === 'boolean' ? roleSettings[event] : true;
        // Debug log per-recipient decision
        console.debug(`notif: user=${doc.id} role=${role} event=${event} enabled=${enabled} hasLineId=${!!lineId}`);
        if (!enabled) {
            results.skipped.push({ uid: doc.id, reason: 'setting_disabled' });
            issues.push({ uid: doc.id, reason: 'setting_disabled', role });
            continue;
        }
        if (!lineId) {
            results.skipped.push({ uid: doc.id, reason: 'no_lineId' });
            issues.push({ uid: doc.id, reason: 'no_lineId', role });
            continue;
        }
        const msgToSend = templates[role] ? templates[role][event] : null;
        if (!msgToSend) {
            results.skipped.push({ uid: doc.id, reason: 'no_message' });
            issues.push({ uid: doc.id, reason: 'no_message', role });
            console.warn(`notif: no message template for role=${role} event=${event}`);
            continue;
        }
        try {
            const messages = [{ type: 'flex', altText: msgToSend.altText || '', contents: msgToSend.contents }];
            await sendPushMessage(lineId, messages);
            results.sent.push({ uid: doc.id, lineId });
        } catch (err: any) {
            console.error('Error sending push message to', lineId, err);
            const errBody = err && err.body ? err.body : String(err);
            results.errors.push({ uid: doc.id, lineId, error: errBody });
            issues.push({ uid: doc.id, reason: 'send_error', role, details: errBody });
        }
    }

    // Optionally notify admins if there were skipped recipients or errors
    try {
        const alertAdmins = notifSettings.alertAdminOnIssues === true;
        if (alertAdmins && (issues.length > 0)) {
            // build a concise summary
            const counts = { sent: results.sent.length, skipped: results.skipped.length, errors: results.errors.length, totalRecipients: recipientDocs.length };
            const topReasons: any = {};
            for (const it of issues) topReasons[it.reason] = (topReasons[it.reason] || 0) + 1;
            const reasonList = Object.entries(topReasons).map(([r, c]) => `${r}:${c}`).join(', ');
            const summary = `Notifications for event ${event} had issues. recipients=${counts.totalRecipients} sent=${counts.sent || results.sent.length} skipped=${counts.skipped} errors=${counts.errors} reasons=${reasonList}`;

            // find admins with lineId
            const adminSnaps = await db.collection('users').where('role', '==', 'admin').get();
            const admins = adminSnaps.docs.map(d => ({ uid: d.id, ...d.data() } as any)).filter((a: any) => a.lineId);
            if (admins.length > 0) {
                for (const a of admins) {
                    try {
                        await sendPushMessage((a as any).lineId, { text: summary });
                    } catch (e) {
                        console.error('Failed to send admin alert', a.uid, e);
                        results.errors.push({ uid: a.uid, reason: 'admin_alert_failed', error: String(e) });
                    }
                }
                results.adminAlertsSent = true;
            } else {
                console.warn('No admin recipients with lineId to send notification issues summary');
            }
        }
    } catch (e) {
        console.error('Error while attempting to send admin alerts about notification issues', e);
        results.errors.push({ reason: 'admin_alert_error', error: String(e) });
    }

    return results;
}
