"use client";

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerModalProps {
    onClose: () => void;
    onScan: (decodedText: string) => void;
}

export default function QRScannerModal({ onClose, onScan }: QRScannerModalProps) {
    const [isScanning, setIsScanning] = useState(true);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        const initRawScanner = async () => {
            try {
                const html5QrCode = new Html5Qrcode("reader");
                scannerRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 280, height: 280 }, // Increased from 250
                        aspectRatio: 1.0
                    },
                    (decodedText) => {
                        onScan(decodedText);
                        onClose(); // Close immediately on success
                    },
                    (errorMessage) => {
                        // ignore scanning errors
                    }
                );
            } catch (err) {
                console.error("Error starting scanner", err);
            }
        };

        initRawScanner();

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(err => console.error(err));
            }
        };
    }, [onClose, onScan]);

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center">
            <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-teal-600 to-teal-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <h3 className="font-bold text-white text-lg">สแกน QR Code</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Camera Area - Larger */}
                <div className="relative bg-black h-[400px] flex items-center justify-center overflow-hidden">
                    <div id="reader" className="w-full h-full"></div>
                    <style jsx global>{`
                        #reader {
                            border: none !important;
                        }
                        #reader video {
                            border-radius: 0 !important;
                            object-fit: cover !important;
                        }
                        #reader__scan_region {
                            border: 3px solid #14b8a6 !important;
                            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5) !important;
                        }
                        #reader__dashboard_section {
                            display: none !important;
                        }
                        #reader__camera_selection {
                            display: none !important;
                        }
                    `}</style>
                </div>

                {/* Instructions - Cleaner */}
                <div className="p-6 bg-gray-50">
                    <div className="flex items-center justify-center gap-2 text-gray-600">
                        <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium">วาง QR Code ให้อยู่ในกรอบสี่เหลี่ยม</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
