"use client";

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';

type AlertType = 'success' | 'error' | 'info' | 'warning';

interface ModalState {
    type: 'alert' | 'confirm';
    message: string;
    // Alert specific
    alertType?: AlertType;
    onClose?: () => void;
    // Confirm specific
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface ModalContextType {
    showAlert: (message: string, type?: AlertType) => Promise<void>;
    showConfirm: (message: string, options?: { confirmText?: string; cancelText?: string }) => Promise<boolean>;
    closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [modal, setModal] = useState<ModalState | null>(null);

    const showAlert = useCallback((message: string, type: AlertType = 'info'): Promise<void> => {
        return new Promise((resolve) => {
            setModal({
                type: 'alert',
                message,
                alertType: type,
                onClose: () => {
                    setModal(null);
                    resolve();
                }
            });
        });
    }, []);

    const showConfirm = useCallback((message: string, options: { confirmText?: string; cancelText?: string } = {}): Promise<boolean> => {
        return new Promise((resolve) => {
            setModal({
                type: 'confirm',
                message,
                confirmText: options.confirmText || 'ยืนยัน',
                cancelText: options.cancelText || 'ยกเลิก',
                onConfirm: () => {
                    setModal(null);
                    resolve(true);
                },
                onCancel: () => {
                    setModal(null);
                    resolve(false);
                }
            });
        });
    }, []);

    const closeModal = useCallback(() => {
        setModal(null);
    }, []);

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm, closeModal }}>
            {children}
            {modal && <ModalComponent modal={modal} />}
        </ModalContext.Provider>
    );
}

export function useModal() {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within ModalProvider');
    }
    return context;
}

function ModalComponent({ modal }: { modal: ModalState }) {
    const getAlertStyles = () => {
        switch (modal.alertType) {
            case 'success':
                return { bg: 'bg-green-50', border: 'border-green-200', icon: '✓', iconBg: 'bg-green-100', iconColor: 'text-green-600' };
            case 'error':
                return { bg: 'bg-red-50', border: 'border-red-200', icon: '✕', iconBg: 'bg-red-100', iconColor: 'text-red-600' };
            case 'warning':
                return { bg: 'bg-amber-50', border: 'border-amber-200', icon: '!', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' };
            default:
                return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'i', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' };
        }
    };

    const styles = modal.type === 'alert' ? getAlertStyles() : { bg: '', border: '', icon: '', iconBg: '', iconColor: '' };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
                onClick={modal.type === 'alert' ? modal.onClose : modal.onCancel}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full animate-scale-in overflow-hidden">
                {modal.type === 'alert' ? (
                    // Alert Modal
                    <div className={`p-6 ${styles.bg} ${styles.border} border-b`}>
                        <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 ${styles.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                                <span className={`text-lg font-bold ${styles.iconColor}`}>{styles.icon}</span>
                            </div>
                            <div className="flex-1 pt-1">
                                <p className="text-gray-800 text-sm leading-relaxed">{modal.message}</p>
                            </div>
                        </div>
                        <button
                            onClick={modal.onClose}
                            className="mt-4 w-full py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            ตกลง
                        </button>
                    </div>
                ) : (
                    // Confirm Modal
                    <>
                        <div className="p-6">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">?</span>
                            </div>
                            <p className="text-center text-gray-800 text-sm leading-relaxed">{modal.message}</p>
                        </div>
                        <div className="flex border-t border-gray-100">
                            <button
                                onClick={modal.onCancel}
                                className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
                            >
                                {modal.cancelText}
                            </button>
                            <button
                                onClick={modal.onConfirm}
                                className="flex-1 py-3 text-sm font-medium text-teal-600 hover:bg-teal-50 transition-colors"
                            >
                                {modal.confirmText}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
