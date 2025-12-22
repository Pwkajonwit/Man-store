"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LiffQueryRouter() {
    const router = useRouter()

    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search)
            let bookingId = params.get('bookingId')

            // LIFF sometimes passes encoded state like liff.state=%3FbookingId%3Dxxx
            if (!bookingId) {
                const liffState = params.get('liff.state') || params.get('state') || ''
                if (liffState) {
                    try {
                        const decoded = decodeURIComponent(liffState)
                        const inner = new URLSearchParams(decoded.replace(/^\?/, ''))
                        bookingId = inner.get('bookingId')
                    } catch (e) {
                        // ignore
                    }
                }
            }

            if (bookingId) {
                // use replace so user won't go back to the LIFF start URL
                router.replace(`/confirm/booking/${bookingId}`)
            }
        } catch (e) {
            // ignore
        }
    }, [router])

    return null
}
