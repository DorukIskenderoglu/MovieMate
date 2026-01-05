import React, { useState } from 'react';

function OnboardingModal({ movies, onComplete, onClose }) {
    const [selectedMovies, setSelectedMovies] = useState([]);
    const [imageErrors, setImageErrors] = useState({});

    const toggleMovieSelection = (movie) => {
        setSelectedMovies(prev => {
            const isSelected = prev.some(m => m.id === movie.id);
            if (isSelected) {
                return prev.filter(m => m.id !== movie.id);
            } else {
                return [...prev, movie];
            }
        });
    };

    const handleImageError = (movieId) => {
        setImageErrors(prev => ({ ...prev, [movieId]: true }));
    };

    const handleContinue = () => {
        if (selectedMovies.length >= 4) {
            onComplete(selectedMovies);
        }
    };

    const isSelected = (movie) => {
        return selectedMovies.some(m => m.id === movie.id);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#0a192f] rounded-3xl border border-gray-800 max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-[#0a192f] border-b border-gray-800 p-6 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-3xl font-black text-white">Hoş Geldiniz!</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition text-2xl"
                        >
                            ×
                        </button>
                    </div>
                    <p className="text-gray-400 mb-4">
                        Size daha iyi öneriler sunabilmemiz için en az 4 film beğenin.
                    </p>
                    <div className="flex items-center gap-2">
                        <div className={`px-4 py-2 rounded-xl font-bold ${
                            selectedMovies.length >= 4 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-800 text-gray-400'
                        }`}>
                            {selectedMovies.length} / 4 seçildi
                        </div>
                        {selectedMovies.length < 4 && (
                            <span className="text-sm text-gray-500">
                                En az {4 - selectedMovies.length} film daha seçin
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    {movies.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">Filmler yükleniyor...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {movies.map((movie) => {
                                const selected = isSelected(movie);
                                const hasError = imageErrors[movie.id];
                                
                                return (
                                    <div
                                        key={movie.id}
                                        className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                                            selected 
                                                ? 'border-accent-red shadow-lg shadow-red-900/40' 
                                                : 'border-gray-800 hover:border-gray-700'
                                        }`}
                                        onClick={() => toggleMovieSelection(movie)}
                                    >
                                        {/* Like button overlay */}
                                        <div className="absolute top-2 right-2 z-10">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                                selected 
                                                    ? 'bg-accent-red text-white scale-110' 
                                                    : 'bg-black/50 text-gray-400 group-hover:bg-black/70'
                                            }`}>
                                                <svg
                                                    className={`w-6 h-6 ${selected ? 'fill-current' : ''}`}
                                                    fill={selected ? 'currentColor' : 'none'}
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                                    />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Movie poster */}
                                        {hasError || !movie.poster ? (
                                            <div className="w-full aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                                <div className="text-center p-4">
                                                    <div className="text-4xl mb-2">🎬</div>
                                                    <p className="text-xs text-gray-500 font-semibold truncate px-2">{movie.title}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <img
                                                src={movie.poster}
                                                alt={movie.title}
                                                className="w-full aspect-[2/3] object-cover"
                                                onError={() => handleImageError(movie.id)}
                                            />
                                        )}

                                        {/* Movie info overlay on hover */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                            <h3 className="text-white font-bold text-sm mb-1 truncate">{movie.title}</h3>
                                            <p className="text-gray-400 text-xs">{movie.year || ''}</p>
                                            {movie.imdb && (
                                                <p className="text-yellow-400 text-xs mt-1">⭐ {movie.imdb}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="sticky bottom-0 bg-[#0a192f] border-t border-gray-800 p-6 flex justify-end gap-4">
                    <button
                        onClick={handleContinue}
                        disabled={selectedMovies.length < 4}
                        className={`px-8 py-3 rounded-xl font-bold transition-all ${
                            selectedMovies.length >= 4
                                ? 'bg-accent-red text-white hover:bg-red-700 shadow-lg shadow-red-900/40'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        Devam Et
                    </button>
                </div>
            </div>
        </div>
    );
}

export default OnboardingModal;

