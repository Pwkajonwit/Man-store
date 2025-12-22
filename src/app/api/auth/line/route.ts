import { NextResponse } from 'next/server';
import admin from '@/lib/firebaseAdmin';

/**
 * POST /api/auth/line
 * Exchange LINE access token for Firebase custom token
 * 
 * Body: { accessToken: string }
 * Response: { customToken: string } | { needsLink: true, profile: {...} }
 */
export async function POST(request: Request) {
    try {
        console.log('[Auth API] Starting authentication request');

        // Verify Firebase Admin is initialized
        if (!admin.apps.length) {
            console.error('[Auth API] Firebase Admin not initialized!');
            return NextResponse.json(
                { error: 'Server configuration error', details: 'Firebase Admin not initialized' },
                { status: 500 }
            );
        }

        const { accessToken } = await request.json();

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Missing accessToken' },
                { status: 400 }
            );
        }

        // For mock tokens, handle specially
        if (accessToken === 'MOCK_ACCESS_TOKEN') {
            console.log('[Auth API] Mock access token detected, using mock flow');

            // Check if a test user exists or create one
            const mockLineId = 'U_TEST_1234567890ABCDEF';
            const db = admin.firestore();

            try {
                // Try to find user by lineId
                const usersRef = db.collection('users');
                const snapshot = await usersRef.where('lineId', '==', mockLineId).limit(1).get();

                let uid;
                let userData;

                if (snapshot.empty) {
                    // No user found, return needsLink
                    return NextResponse.json({
                        needsLink: true,
                        profile: {
                            lineId: mockLineId,
                            displayName: 'คุณ ทดสอบ',
                            pictureUrl: 'https://lh5.googleusercontent.com/d/10mcLZP15XqebnVb1IaODQLhZ93EWT7h7'
                        }
                    });
                } else {
                    // User found
                    const userDoc = snapshot.docs[0];
                    uid = userDoc.id;
                    userData = userDoc.data();
                }

                // Create custom token
                const customToken = await admin.auth().createCustomToken(uid);

                return NextResponse.json({
                    customToken,
                    userProfile: {
                        uid: uid,
                        ...userData
                    }
                });

            } catch (error: any) {
                console.error('Mock auth error:', error);
                return NextResponse.json(
                    { error: 'Authentication failed', details: error.message },
                    { status: 500 }
                );
            }
        }

        // Real LINE token flow
        // Verify the LINE access token by calling LINE API
        const lineResponse = await fetch('https://api.line.me/v2/profile', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (!lineResponse.ok) {
            console.error('LINE API error:', lineResponse.status, await lineResponse.text());
            return NextResponse.json(
                { error: 'Invalid LINE access token' },
                { status: 401 }
            );
        }

        const lineProfile = await lineResponse.json();
        const lineId = lineProfile.userId;

        // Check if user exists in Firestore with this LINE ID
        const db = admin.firestore();
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('lineId', '==', lineId).limit(1).get();

        if (snapshot.empty) {
            // No user found with this LINE ID - needs to be linked
            return NextResponse.json({
                needsLink: true,
                profile: {
                    lineId: lineId,
                    displayName: lineProfile.displayName,
                    pictureUrl: lineProfile.pictureUrl
                }
            });
        }

        // User found - create custom token
        const userDoc = snapshot.docs[0];
        const uid = userDoc.id;
        const userData = userDoc.data();

        // Optionally update LINE profile info
        await userDoc.ref.update({
            displayName: lineProfile.displayName,
            pictureUrl: lineProfile.pictureUrl,
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
        });

        const customToken = await admin.auth().createCustomToken(uid);

        // ส่ง userProfile กลับมาด้วยเพื่อลดการดึงข้อมูลซ้ำ
        return NextResponse.json({
            customToken,
            userProfile: {
                uid: uid,
                ...userData,
                displayName: lineProfile.displayName,
                pictureUrl: lineProfile.pictureUrl
            }
        });

    } catch (error: any) {
        console.error('Auth exchange error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
