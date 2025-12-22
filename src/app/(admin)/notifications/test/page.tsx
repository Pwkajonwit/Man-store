"use client";

import { useState } from 'react';

export default function TestNotificationsPage() {
    const [eventType, setEventType] = useState('booking_created');
    const [bookingId, setBookingId] = useState('TEST-123');
    const [requesterName, setRequesterName] = useState('Somchai');
    const [userEmail, setUserEmail] = useState('somchai@example.com');
    const [vehicleLicensePlate, setVehicleLicensePlate] = useState('กข-1234');
    const [startDate, setStartDate] = useState(new Date().toISOString());
    const [endDate, setEndDate] = useState(new Date(Date.now() + 3600 * 1000 * 24).toISOString());
    const [returnedAt, setReturnedAt] = useState('');
    const [preview, setPreview] = useState<any>(null);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const buildPayload = () => ({
        event: eventType,
        booking: {
            id: bookingId,
            requesterName,
            userEmail,
            vehicleLicensePlate,
            startDate,
            endDate,
            returnedAt: returnedAt || null
        }
    });

    const handlePreview = () => {
        setPreview(buildPayload());
        setResult(null);
    };

    const handleSend = async () => {
        const payload = buildPayload();
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            setResult({ ok: res.ok, status: res.status, data });
        } catch (err) {
            setResult({ ok: false, error: String(err) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">ทดสอบการส่ง Flex Notification</h1>

            <div className="bg-white p-4 rounded shadow space-y-3">
                <label className="block text-sm">Event</label>
                <select value={eventType} onChange={e => setEventType(e.target.value)} className="w-full p-2 border rounded">
                    <option value="booking_created">booking_created</option>
                    <option value="booking_approval_request">booking_approval_request</option>
                    <option value="booking_approved">booking_approved</option>
                    <option value="vehicle_sent">vehicle_sent</option>
                    <option value="vehicle_returned">vehicle_returned</option>
                </select>

                <label className="block text-sm">Booking ID</label>
                <input className="w-full p-2 border rounded" value={bookingId} onChange={e => setBookingId(e.target.value)} />

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm">Requester Name</label>
                        <input className="w-full p-2 border rounded" value={requesterName} onChange={e => setRequesterName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm">User Email</label>
                        <input className="w-full p-2 border rounded" value={userEmail} onChange={e => setUserEmail(e.target.value)} />
                    </div>
                </div>

                <label className="block text-sm">Vehicle License Plate</label>
                <input className="w-full p-2 border rounded" value={vehicleLicensePlate} onChange={e => setVehicleLicensePlate(e.target.value)} />

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm">Start Date</label>
                        <input className="w-full p-2 border rounded" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm">End Date</label>
                        <input className="w-full p-2 border rounded" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>

                <label className="block text-sm">Returned At (optional)</label>
                <input className="w-full p-2 border rounded" value={returnedAt} onChange={e => setReturnedAt(e.target.value)} />

                <div className="flex gap-3 justify-end pt-2">
                    <button onClick={handlePreview} className="px-4 py-2 bg-gray-200 rounded">Preview</button>
                    <button onClick={handleSend} disabled={loading} className="px-4 py-2 bg-teal-600 text-white rounded">{loading ? 'Sending...' : 'Send'}</button>
                </div>
            </div>

            {preview && (
                <div className="mt-4 bg-white p-4 rounded shadow">
                    <h2 className="font-semibold mb-2">Payload Preview</h2>
                    <pre className="text-xs max-h-64 overflow-auto">{JSON.stringify(preview, null, 2)}</pre>
                </div>
            )}

            {result && (
                <div className="mt-4 bg-white p-4 rounded shadow">
                    <h2 className="font-semibold mb-2">Result</h2>
                    <pre className="text-xs max-h-64 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}
