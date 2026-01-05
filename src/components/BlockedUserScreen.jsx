import React from 'react';
import { logout } from '../services/authService.js';

export default function BlockedUserScreen({ onLogout }) {
    const handleLogout = () => {
        logout();
        if (onLogout) {
            onLogout();
        } else {
            // Reload page to show login screen
            window.location.reload();
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-2">
                        MOVİE<span className="text-accent-red">MATE</span>
                    </h1>
                </div>

                <div className="bg-[#0a192f] border border-red-500/50 rounded-3xl p-8 shadow-2xl">
                    <div className="text-center">
                        {/* Blocked Icon */}
                        <div className="mb-6">
                            <div className="mx-auto w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                                <svg 
                                    className="w-12 h-12 text-red-500" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        strokeWidth={2} 
                                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" 
                                    />
                                </svg>
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className="text-2xl font-bold text-white mb-4">
                            Hesabınız Engellenmiştir
                        </h2>

                        {/* Message */}
                        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 mb-6">
                            <p className="text-red-400 text-sm leading-relaxed mb-4">
                                Üzgünüz, hesabınız yönetici tarafından engellenmiştir. 
                                Bu işlem, platform kurallarını ihlal ettiğiniz için yapılmış olabilir.
                            </p>
                            <p className="text-gray-400 text-sm">
                                Hesabınızla ilgili sorularınız için lütfen destek ekibi ile iletişime geçin.
                            </p>
                        </div>

                        {/* Contact Info */}
                        <div className="bg-gray-900/40 border border-white/10 rounded-xl p-4 mb-6">
                            <p className="text-gray-400 text-xs mb-2">Destek için:</p>
                            <p className="text-white text-sm font-semibold">support@moviemate.com</p>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-xl transition-all border border-gray-700"
                        >
                            Çıkış Yap
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

