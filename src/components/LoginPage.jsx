import React, { useState } from 'react';
import { login } from '../services/authService.js';

export default function LoginPage({ onLoginSuccess, onSwitchToSignUp }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(email, password);
        
        if (result.success) {
            onLoginSuccess(result.user);
        } else {
            setError(result.error || 'Giriş yapılamadı');
        }
        
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-2">
                        MOVİE<span className="text-accent-red">MATE</span>
                    </h1>
                    <p className="text-gray-500 text-sm">Hesabınıza giriş yapın</p>
                </div>

                <div className="bg-[#0a192f] border border-gray-800 rounded-3xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/20 border border-red-500 rounded-xl p-4">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-400 mb-2">
                                E-posta
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-gray-900/40 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red outline-none transition-all text-white placeholder-gray-500"
                                placeholder="ornek@email.com"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-gray-400 mb-2">
                                Şifre
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-900/40 border border-white/10 rounded-xl py-3 px-4 focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red outline-none transition-all text-white placeholder-gray-500"
                                placeholder="••••••••"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-accent-red text-white font-bold py-3 px-6 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-500 text-sm">
                            Hesabınız yok mu?{' '}
                            <button
                                onClick={onSwitchToSignUp}
                                className="text-accent-red hover:text-red-400 font-semibold transition"
                            >
                                Kayıt Ol
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

