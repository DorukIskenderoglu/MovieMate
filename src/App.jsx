import React, { useState, useEffect } from 'react';
import { getRecommendedMovies } from './services/recommendationService.js';
import { getTopRatedMovies, searchMoviesInTMDB, searchMoviesByGenre, getMovieDetails, getWatchProviders, getTopMoviesForOnboarding } from './services/movieApiService.js';
import { 
    getWatchedMovies, 
    setWatchedMovie, 
    removeWatchedMovie, 
    isWatched, 
    getUserRating, 
    setUserRating,
    getAllUserRatings,
    getWantToWatchMovies,
    setWantToWatchMovie,
    removeWantToWatchMovie,
    isWantToWatch,
    getFavorites,
    setFavorites as saveFavorites,
    migrateLegacyDataToUser,
    isFirstTimeUser,
    setOnboardingComplete
} from './services/userDataService.js';
import { getCurrentUser, isAuthenticated, logout as authLogout, isUserBlocked } from './services/authService.js';
import { getImageUrl, getThumbnailUrl } from './config/api.js';
import StarRating from './components/StarRating.jsx';
import LoginPage from './components/LoginPage.jsx';
import SignUpPage from './components/SignUpPage.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import BlockedUserScreen from './components/BlockedUserScreen.jsx';

// Global cache for loaded images (prevents flashing on re-render)
// This persists across component re-renders
const loadedImagesCache = new Set();

function App() {
    // Authentication state
    const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [showSignUp, setShowSignUp] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    
    const [activePage, setActivePage] = useState("home"); // home, profile, detail, special
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [favorites, setFavorites] = useState([]);
    const [search, setSearch] = useState("");
    const [recommendationLoading, setRecommendationLoading] = useState(false);
    const [recommendedMovies, setRecommendedMovies] = useState([]);
    
    // Watched and rating states
    const [watchedMovies, setWatchedMovies] = useState([]);
    const [userRatings, setUserRatings] = useState({});
    const [wantToWatchMovies, setWantToWatchMovies] = useState([]);
    
    // TMDB dataset browsing states - Now primary source
    const [tmdbMovies, setTmdbMovies] = useState([]);
    const [tmdbLoading, setTmdbLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Infinite scroll states
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMoreMovies, setHasMoreMovies] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // Watch providers state
    const [watchProviders, setWatchProviders] = useState(null);
    
    // Onboarding state
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingMovies, setOnboardingMovies] = useState([]);
    const [onboardingLoading, setOnboardingLoading] = useState(false);
    
    // Check authentication and load user data on mount
    useEffect(() => {
        const checkAuth = () => {
            const authenticated = isAuthenticated();
            const user = getCurrentUser();
            
            setIsAuthenticatedState(authenticated);
            setCurrentUser(user);
            
            if (authenticated && user) {
                // Check if user is blocked
                const blocked = isUserBlocked(user.id) || (user.blocked === true);
                setIsBlocked(blocked);
                
                if (blocked) {
                    // Don't load user data if blocked
                    return;
                }
                
                // Migrate legacy data if needed
                migrateLegacyDataToUser(user.id);
                
                // Load user-specific data
                loadUserData(user.id);
                
                // Check if first-time user and show onboarding
                if (isFirstTimeUser(user.id)) {
                    loadOnboardingMovies();
                }
            } else {
                setIsBlocked(false);
            }
        };
        
        checkAuth();
        
        // Check blocked status periodically (in case user is blocked while logged in)
        const interval = setInterval(() => {
            const user = getCurrentUser();
            if (user) {
                const blocked = isUserBlocked(user.id);
                setIsBlocked(blocked);
            }
        }, 5000); // Check every 5 seconds
        
        return () => clearInterval(interval);
    }, []);
    
    // Load onboarding movies
    const loadOnboardingMovies = async () => {
        setOnboardingLoading(true);
        try {
            const movies = await getTopMoviesForOnboarding();
            setOnboardingMovies(movies);
            setShowOnboarding(true);
        } catch (error) {
            console.error('Error loading onboarding movies:', error);
        } finally {
            setOnboardingLoading(false);
        }
    };
    
    // Handle onboarding completion
    const handleOnboardingComplete = (selectedMovies) => {
        if (!currentUser || selectedMovies.length < 4) return;
        
        // Save selected movies as favorites
        saveFavorites(selectedMovies, currentUser.id);
        setFavorites(selectedMovies);
        
        // Mark onboarding as complete
        setOnboardingComplete(currentUser.id);
        
        // Close modal
        setShowOnboarding(false);
        
        // Recommendations will automatically update since favorites changed
    };
    
    // Load user-specific data
    const loadUserData = (userId) => {
        try {
            const watched = getWatchedMovies(userId);
            const ratings = getAllUserRatings(userId);
            const wantToWatch = getWantToWatchMovies(userId);
            const userFavorites = getFavorites(userId);
            
            setWatchedMovies(watched || []);
            setUserRatings(ratings || {});
            setWantToWatchMovies(wantToWatch || []);
            setFavorites(userFavorites || []);
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };
    
    // Handle successful login
    const handleLoginSuccess = (user) => {
        setCurrentUser(user);
        setIsAuthenticatedState(true);
        setShowSignUp(false);
        
        // Check if user is blocked
        const blocked = isUserBlocked(user.id) || (user.blocked === true);
        setIsBlocked(blocked);
        
        if (blocked) {
            // Don't load user data if blocked
            return;
        }
        
        // Migrate legacy data if needed
        migrateLegacyDataToUser(user.id);
        // Load user-specific data
        loadUserData(user.id);
        // Check if first-time user and show onboarding
        if (isFirstTimeUser(user.id)) {
            loadOnboardingMovies();
        }
    };
    
    // Handle successful signup
    const handleSignUpSuccess = (user) => {
        setCurrentUser(user);
        setIsAuthenticatedState(true);
        setShowSignUp(false);
        // Load user-specific data
        loadUserData(user.id);
        // New users are always first-time users, show onboarding
        loadOnboardingMovies();
    };
    
    // Handle logout
    const handleLogout = () => {
        authLogout();
        setIsAuthenticatedState(false);
        setCurrentUser(null);
        setIsBlocked(false);
        setFavorites([]);
        setWatchedMovies([]);
        setUserRatings({});
        setWantToWatchMovies([]);
        setActivePage("home");
    };

    const [selectedGenre, setSelectedGenre] = useState("Tüm Filmler");
    const [sortBy, setSortBy] = useState(null); // null (default: new movies sorted by rating), 'most_liked', or 'most_rated'
    const genres = ["Tüm Filmler", "Bilim Kurgu", "Komedi", "Aksiyon/Macera", "Animasyon", "Suç", "Drama", "Gizem", "Belgesel", "Korku"];

    const toggleFavorite = (movie) => {
        if (!currentUser) return;
        
        if (favorites.find(m => m.id === movie.id)) {
            const newFavorites = favorites.filter(m => m.id !== movie.id);
            setFavorites(newFavorites);
            saveFavorites(newFavorites, currentUser.id);
        } else {
            const newFavorites = [...favorites, movie];
            setFavorites(newFavorites);
            saveFavorites(newFavorites, currentUser.id);
            
            // If movie is in want to watch list, remove it (watch later is mutually exclusive)
            const isInWantToWatch = isMovieWantToWatch(movie);
            if (isInWantToWatch) {
                removeWantToWatchMovie(movie.id, currentUser.id);
                // Update want to watch state
                setWantToWatchMovies(prevWantToWatch => {
                    return prevWantToWatch.filter(id => id !== movie.id).filter(m => !m || m.id !== movie.id);
                });
            }
        }
    };

    const handleMovieClick = async (movie) => {
        // Always fetch full details to ensure we have director, cast, and all genres
        const movieId = movie.tmdbId || movie.id;
        if (movieId) {
            try {
                const fullDetails = await getMovieDetails(movieId);
                if (fullDetails) {
                    // Merge with existing movie data to preserve any local data
                    setSelectedMovie({
                        ...movie,
                        ...fullDetails,
                        // Preserve user-specific data
                        id: movie.id,
                        isWatched: movie.isWatched,
                        userRating: movie.userRating
                    });
                } else {
                    setSelectedMovie(movie);
                }
            } catch (error) {
                console.error('Error fetching movie details:', error);
                setSelectedMovie(movie);
            }
        } else {
            setSelectedMovie(movie);
        }
        setActivePage("detail");
    };

    // Helper function to check if a movie is watched
    const isMovieWatched = (movie) => {
        if (!movie || !movie.id) return false;
        return watchedMovies.some(id => id === movie.id) || watchedMovies.some(m => m && m.id === movie.id);
    };

    // Helper function to get user rating for a movie
    const getMovieRating = (movie) => {
        if (!movie || !movie.id || !currentUser) return null;
        return userRatings[movie.id] || null;
    };

    // Toggle watched status for a movie
    const toggleWatched = (movie) => {
        if (!movie || !movie.id || !currentUser) return;
        
        // Check if movie is in want to watch list
        const isInWantToWatch = isMovieWantToWatch(movie);
        
        setWatchedMovies(prevWatched => {
            // Check if it's an array of IDs or array of movie objects
            const isWatched = prevWatched.some(id => id === movie.id) || prevWatched.some(m => m && m.id === movie.id);
            if (isWatched) {
                // Remove from watched
                // Use service function to persist to localStorage
                removeWatchedMovie(movie.id, currentUser.id);
                return prevWatched.filter(id => id !== movie.id).filter(m => !m || m.id !== movie.id);
            } else {
                // Add to watched (store as ID)
                // Use service function to persist to localStorage
                setWatchedMovie(movie.id, currentUser.id);
                
                // If movie is in want to watch list, remove it
                if (isInWantToWatch) {
                    removeWantToWatchMovie(movie.id, currentUser.id);
                    // Update want to watch state
                    setWantToWatchMovies(prevWantToWatch => {
                        return prevWantToWatch.filter(id => id !== movie.id).filter(m => !m || m.id !== movie.id);
                    });
                }
                
                return [...prevWatched, movie.id];
            }
        });
    };

    // Handle user rating (0.5-5 scale)
    const handleRating = (movie, rating) => {
        if (!movie || !movie.id || !currentUser) return;
        
        // Check if movie is already watched before state updates
        const alreadyWatched = isMovieWatched(movie);
        // Check if movie is in want to watch list
        const isInWantToWatch = isMovieWantToWatch(movie);
        
        setUserRatings(prevRatings => {
            const newRatings = { ...prevRatings };
            // Minimum rating is 0.5, so check for values less than 0.5 or null
            if (rating === null || rating === 0 || rating < 0.5) {
                delete newRatings[movie.id];
                setUserRating(movie.id, null, currentUser.id);
            } else {
                // Ensure rating is between 0.5 and 5
                const clampedRating = Math.max(0.5, Math.min(5, rating));
                newRatings[movie.id] = clampedRating;
                setUserRating(movie.id, clampedRating, currentUser.id);
            }
            return newRatings;
        });
        
        // Automatically add to watched list when user rates a movie (if not already watched)
        if (rating !== null && rating >= 0.5 && !alreadyWatched) {
            // Use service function to persist to localStorage
            setWatchedMovie(movie.id, currentUser.id);
            // Update state
            setWatchedMovies(prevWatched => {
                // Check if already in watched list
                const isAlreadyWatched = prevWatched.some(id => id === movie.id) || 
                                         prevWatched.some(m => m && m.id === movie.id);
                if (!isAlreadyWatched) {
                    return [...prevWatched, movie.id];
                }
                return prevWatched;
            });
        }
        
        // If movie is in want to watch list and user rates it, remove from want to watch
        if (rating !== null && rating >= 0.5 && isInWantToWatch) {
            // Use service function to persist to localStorage
            removeWantToWatchMovie(movie.id, currentUser.id);
            // Update state
            setWantToWatchMovies(prevWantToWatch => {
                return prevWantToWatch.filter(id => id !== movie.id).filter(m => !m || m.id !== movie.id);
            });
        }
    };

    // Alias for compatibility
    const handleRatingChange = handleRating;

    // Get average user rating
    const getAverageUserRating = () => {
        const ratings = Object.values(userRatings);
        if (ratings.length === 0) return '0';
        const sum = ratings.reduce((acc, rating) => acc + rating, 0);
        return (sum / ratings.length).toFixed(1);
    };

    // Helper function to check if a movie is in want to watch list
    const isMovieWantToWatch = (movie) => {
        if (!movie || !movie.id) return false;
        return wantToWatchMovies.some(id => id === movie.id) || wantToWatchMovies.some(m => m && m.id === movie.id);
    };

    // Toggle want to watch status for a movie
    const toggleWantToWatch = (movie) => {
        if (!movie || !movie.id || !currentUser) return;
        
        // Check if movie is already watched or in favorites
        const isWatched = isMovieWatched(movie);
        const isFavorite = favorites.find(m => m.id === movie.id);
        
        setWantToWatchMovies(prevWantToWatch => {
            const isWantToWatch = prevWantToWatch.some(id => id === movie.id) || prevWantToWatch.some(m => m && m.id === movie.id);
            if (isWantToWatch) {
                // Remove from want to watch
                removeWantToWatchMovie(movie.id, currentUser.id);
                return prevWantToWatch.filter(id => id !== movie.id).filter(m => !m || m.id !== movie.id);
            } else {
                // Add to want to watch
                // Watch later is mutually exclusive with watched and favorites
                // Remove from watched if it exists
                if (isWatched) {
                    removeWatchedMovie(movie.id, currentUser.id);
                    setWatchedMovies(prevWatched => {
                        return prevWatched.filter(id => id !== movie.id).filter(m => !m || m.id !== movie.id);
                    });
                }
                
                // Remove from favorites if it exists
                if (isFavorite) {
                    const newFavorites = favorites.filter(m => m.id !== movie.id);
                    setFavorites(newFavorites);
                    saveFavorites(newFavorites, currentUser.id);
                }
                
                // Use service function to persist to localStorage
                setWantToWatchMovie(movie.id, currentUser.id);
                return [...prevWantToWatch, movie.id];
            }
        });
    };

    // Fetch recommendations using the new algorithm
    useEffect(() => {
        const fetchRecommendations = async () => {
            // Need at least favorites or watchedMovies to generate recommendations
            if ((favorites.length === 0) && (watchedMovies.length === 0)) {
                setRecommendedMovies([]);
                return;
            }
            
            setRecommendationLoading(true);
            try {
                // Use empty array for local movies since we're only using TMDB now
                // Pass watchedMovies and tmdbMovies for lookup
                const recommendations = await getRecommendedMovies(
                    [],
                    favorites,
                    true, // Always use API now
                    20,
                    watchedMovies, // Pass watched movie IDs
                    tmdbMovies, // Pass all movies for lookup (watchedMovies might contain IDs that need to be resolved)
                    userRatings // ENHANCED: Pass user ratings for more accurate recommendations
                );
                
                // Convert API movies back to display format if needed
                const formattedRecommendations = recommendations.map(movie => {
                    // If it has localData, use that (preserves original format)
                    if (movie.localData) {
                        return movie.localData;
                    }
                    // Otherwise, format API movie to match local structure
                    return {
                        id: movie.id,
                        title: movie.title,
                        year: movie.year,
                        genre: movie.genre,
                        poster: movie.poster,
                        summary: movie.summary,
                        director: movie.director,
                        cast: movie.cast || [],
                        imdb: movie.imdb || '0.0',
                        isAPI: true,
                        recommendationScore: movie.recommendationScore
                    };
                });
                
                setRecommendedMovies(formattedRecommendations);
            } catch (error) {
                console.error('Error fetching recommendations:', error);
                setRecommendedMovies([]);
            } finally {
                setRecommendationLoading(false);
            }
        };
        
        fetchRecommendations();
    }, [favorites, watchedMovies, tmdbMovies, userRatings]); // ENHANCED: Include userRatings in dependencies

    // Load TMDB movies when genre is selected or sortBy changes
    useEffect(() => {
        const loadMoviesByGenre = async () => {
            // Don't load if user is searching
            if (search && search.trim().length > 0) {
                return;
            }
            
            // Reset pagination when genre or sortBy changes
            setCurrentPage(1);
            setHasMoreMovies(true);
            
            // If "Tüm Filmler" (All) is selected, show movies with selected sorting
            if (selectedGenre === "Tüm Filmler") {
                setTmdbLoading(true);
                setError(null);
                try {
                    const results = await getTopRatedMovies(1, 15, sortBy); // OPTIMIZED: Reduced from 20 to 15 for faster loading
                    const validResults = (results || []).filter(m => m !== null);
                    setTmdbMovies(validResults);
                    // Always set to true initially to enable infinite scroll, it will be adjusted during scroll
                    setHasMoreMovies(validResults.length > 0);
                    setCurrentPage(1);
                    setIsLoadingMore(false);
                } catch (error) {
                    console.error('Error loading TMDB movies:', error);
                    setError('Filmler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
                    setTmdbMovies([]);
                    setHasMoreMovies(false);
                } finally {
                    setTmdbLoading(false);
                }
            } else {
                // Load movies for selected genre
                setTmdbLoading(true);
                setError(null);
                try {
                    const genreMovies = await searchMoviesByGenre(selectedGenre, {
                        minRating: 6.0,
                        minVotes: 100,
                        page: 1,
                        limit: 20, // OPTIMIZED: Reduced from 50 to 20 for faster loading
                        sortBy: sortBy
                    });
                    
                    const validMovies = genreMovies.filter(m => m !== null);
                    setTmdbMovies(validMovies);
                    // For categories, ensure infinite scroll works - continue if we got any results
                    // The filtering ensures only movies with the same genre tag are shown
                    setHasMoreMovies(validMovies.length >= 3); // Lower threshold to enable infinite scroll
                    setCurrentPage(1);
                    setIsLoadingMore(false);
                } catch (error) {
                    console.error(`Error loading movies for genre ${selectedGenre}:`, error);
                    setError(`Filmler yüklenirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
                    setTmdbMovies([]);
                    setHasMoreMovies(false);
                } finally {
                    setTmdbLoading(false);
                }
            }
        };
        
        loadMoviesByGenre();
    }, [selectedGenre, search, sortBy]);
    
    // Infinite scroll detection and loading
    useEffect(() => {
        let scrollTimeout;
        let isLoading = false;
        
        const handleScroll = async () => {
            // Debounce scroll events
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(async () => {
                if (isLoading || !hasMoreMovies || isLoadingMore || tmdbLoading || (search && search.trim().length > 0)) {
                    return;
                }
                
                // Check both window and document scroll
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
                const windowHeight = window.innerHeight || document.documentElement.clientHeight;
                const documentHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                const threshold = 500; // Load when 500px from bottom
                
                // Check if user is near bottom of page
                if (scrollTop + windowHeight >= documentHeight - threshold) {
                    isLoading = true;
                    setIsLoadingMore(true);
                    try {
                        let moreMovies = [];
                        const nextPage = currentPage + 1;
                        
                        if (selectedGenre === "Tüm Filmler") {
                            moreMovies = await getTopRatedMovies(nextPage, 15, sortBy); // OPTIMIZED: Reduced from 20 to 15 for faster loading
                        } else {
                            moreMovies = await searchMoviesByGenre(selectedGenre, {
                                minRating: (sortBy === null || sortBy === 'new_most_rated') ? 7.0 : 6.0,
                                minVotes: 100,
                                page: nextPage,
                                limit: 20, // OPTIMIZED: Reduced from 50 to 20 for faster loading
                                sortBy: sortBy
                            });
                        }
                        
                        const validMovies = moreMovies.filter(m => m !== null);
                        if (validMovies.length > 0) {
                            // Append new movies to existing list, avoiding duplicates
                            setTmdbMovies(prev => {
                                const existingIds = new Set(prev.map(m => m.id));
                                const newMovies = validMovies.filter(m => !existingIds.has(m.id));
                                return [...prev, ...newMovies];
                            });
                            setCurrentPage(nextPage);
                            // Be more lenient: continue loading if we got any movies
                            // For default behavior, we switch strategies after page 2, so there should always be more
                            // For categories/genres, continue loading to ensure infinite scroll works with same tag
                            // Only stop if we consistently get very few results
                            const minMoviesForContinue = 3; // Lower threshold for categories to keep scrolling
                            let shouldContinue = false;
                            
                            if (selectedGenre === "Tüm Filmler") {
                                // For "All" category - be more lenient to keep infinite scroll working
                                // Continue if we got any movies, or if we're still in early pages
                                shouldContinue = validMovies.length > 0 || nextPage <= 20;
                            } else {
                                // For specific categories - ensure infinite scroll works with same genre tag
                                // Continue loading as long as we get some results (even if filtered)
                                shouldContinue = validMovies.length >= minMoviesForContinue || nextPage <= 30;
                            }
                            
                            setHasMoreMovies(shouldContinue);
                        } else {
                            // Only stop if we got 0 results
                            setHasMoreMovies(false);
                        }
                    } catch (error) {
                        console.error('Error loading more movies:', error);
                        setHasMoreMovies(false);
                    } finally {
                        setIsLoadingMore(false);
                        isLoading = false;
                    }
                }
            }, 200); // 200ms debounce
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        // Also check on initial mount if content is shorter than viewport
        handleScroll();
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearTimeout(scrollTimeout);
        };
    }, [hasMoreMovies, isLoadingMore, tmdbLoading, search, selectedGenre, currentPage, sortBy]);
    
    // Search TMDB when search query changes
    useEffect(() => {
        const searchTMDB = async () => {
            if (!search || search.trim().length === 0) {
                // Reset to default view when search is cleared - reload based on selected genre
                // This will trigger the genre-based loading useEffect
                return;
            }
            
            setTmdbLoading(true);
            setError(null);
            
            try {
                // Regular movie title search
                const results = await searchMoviesInTMDB(search, 1, 50);
                setTmdbMovies(results || []);
            } catch (error) {
                console.error('Error searching TMDB:', error);
                setError('Arama sırasında bir hata oluştu. Lütfen tekrar deneyin.');
                setTmdbMovies([]);
            } finally {
                setTmdbLoading(false);
            }
        };
        
        const timeoutId = setTimeout(() => {
            searchTMDB();
        }, 500); // Debounce search
        
        return () => clearTimeout(timeoutId);
    }, [search]);

    // Fetch watch providers when selectedMovie changes
    useEffect(() => {
        const fetchWatchProviders = async () => {
            if (!selectedMovie) {
                setWatchProviders(null);
                return;
            }
            
            const movieId = selectedMovie.tmdbId || selectedMovie.id;
            if (!movieId) {
                setWatchProviders(null);
                return;
            }
            
            try {
                const providers = await getWatchProviders(movieId);
                console.log('Fetched watch providers:', providers);
                setWatchProviders(providers);
            } catch (error) {
                console.error('Error fetching watch providers:', error);
                setWatchProviders(null);
            }
        };
        
        fetchWatchProviders();
    }, [selectedMovie]);

    // When genre is selected, movies are already filtered by that genre from API
    // Only apply search filter if searching
    const filteredMovies = search && search.trim().length > 0
        ? tmdbMovies.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
        : tmdbMovies;

    // Component for watched movies list in profile
    const WatchedMoviesList = ({ watchedMovieIds, allMovies, getMovieRating, toggleWatched }) => {
        const watchedWithData = watchedMovieIds
            .map(id => {
                const movie = allMovies.find(m => m.id === id);
                if (!movie) return null;
                const rating = getMovieRating(movie);
                return { ...movie, userRating: rating };
            })
            .filter(Boolean);
        
        if (watchedMovieIds.length === 0) {
            return <p className="text-gray-600 text-sm">Henüz film izlemediniz.</p>;
        }
        
        if (watchedWithData.length === 0) {
            return <p className="text-gray-600 text-sm">Yükleniyor...</p>;
        }
        
        return (
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {watchedWithData.map(m => (
                    <div key={m.id} className="flex justify-between items-center bg-black/30 p-3 rounded-xl">
                        <div className="flex-1">
                            <span className="text-sm font-semibold block">{m.title}</span>
                            {m.userRating && (
                                <span className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                                    ⭐ {typeof m.userRating === 'number' ? m.userRating.toFixed(1) : m.userRating}/5
                                </span>
                            )}
                        </div>
                        <button onClick={() => toggleWatched(m)} className="text-xs text-gray-500 hover:text-green-500 transition">Kaldır</button>
                    </div>
                ))}
            </div>
        );
    };
    
    // Component for want to watch movies list in profile
    const WantToWatchList = ({ wantToWatchMovieIds, allMovies, toggleWantToWatch }) => {
        const wantToWatchWithData = wantToWatchMovieIds
            .map(id => {
                const movie = allMovies.find(m => m.id === id);
                return movie || null;
            })
            .filter(Boolean);
        
        if (wantToWatchMovieIds.length === 0) {
            return <p className="text-gray-600 text-sm">Henüz izlemek istediğiniz film yok.</p>;
        }
        
        if (wantToWatchWithData.length === 0) {
            return <p className="text-gray-600 text-sm">Yükleniyor...</p>;
        }
        
        return (
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {wantToWatchWithData.map(m => (
                    <div key={m.id} className="flex justify-between items-center bg-black/30 p-3 rounded-xl">
                        <span className="text-sm font-semibold">{m.title}</span>
                        <button onClick={() => toggleWantToWatch(m)} className="text-xs text-gray-500 hover:text-blue-500 transition">Kaldır</button>
                    </div>
                ))}
            </div>
        );
    };
    
    // Component for movie poster with optimized image loading - NO FLASHING
    const MoviePoster = React.memo(({ movie, className = "", useThumbnail = true }) => {
        const [imageError, setImageError] = useState(false);
        const imageUrl = useThumbnail 
            ? getThumbnailUrl(movie.poster) 
            : getImageUrl(movie.poster);
        
        // Use ref to persist loaded state across re-renders (prevents flashing)
        const isLoadedRef = React.useRef(loadedImagesCache.has(imageUrl || ''));
        const imgRef = React.useRef(null);
        
        // Check if image is already in cache
        const isCached = imageUrl ? loadedImagesCache.has(imageUrl) : false;
        
        // Initialize state: if cached, start as loaded (no skeleton flash)
        const [imageLoaded, setImageLoaded] = useState(() => {
            if (isCached) {
                isLoadedRef.current = true;
                return true;
            }
            return false;
        });
        
        // Check browser cache on mount
        React.useEffect(() => {
            if (!imageUrl || imageLoaded || isCached) return;
            
            // Pre-check if image is in browser cache
            const img = new Image();
            const checkCache = () => {
                if (img.complete && img.naturalHeight !== 0) {
                    loadedImagesCache.add(imageUrl);
                    isLoadedRef.current = true;
                    setImageLoaded(true);
                }
            };
            
            img.onload = () => {
                loadedImagesCache.add(imageUrl);
                isLoadedRef.current = true;
                setImageLoaded(true);
            };
            
            img.src = imageUrl;
            checkCache();
        }, [imageUrl]); // Only run when URL changes
        
        // Handle image load
        const handleImageLoad = React.useCallback(() => {
            if (imageUrl) {
                loadedImagesCache.add(imageUrl);
            }
            isLoadedRef.current = true;
            setImageLoaded(true);
        }, [imageUrl]);
        
        // Handle image load errors
        const handleImageError = React.useCallback(() => {
            setImageError(true);
        }, []);
        
        // Show placeholder if no poster or error
        if (imageError || !movie.poster) {
            return (
                <div className={`${className} bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center overflow-hidden`}>
                    <div className="text-center p-4">
                        <div className="text-4xl mb-2">🎬</div>
                        <p className="text-xs text-gray-500 font-semibold truncate px-2">{movie.title}</p>
                    </div>
                </div>
            );
        }
        
        // If cached, show immediately without transition (prevents flashing)
        const showImmediately = isCached || isLoadedRef.current;
        
        return (
            <div className={`${className} overflow-hidden bg-gray-900 flex items-center justify-center relative`}>
                {/* Loading placeholder (skeleton) - only show if image hasn't loaded yet */}
                {!imageLoaded && !showImmediately && (
                    <div className="absolute inset-0 bg-gray-800 animate-pulse z-10" />
                )}
                <img 
                    ref={imgRef}
                    src={imageUrl} 
                    className={`w-full h-full object-contain ${
                        showImmediately 
                            ? 'opacity-100' // No transition for cached images (prevents flash)
                            : imageLoaded 
                                ? 'opacity-100 transition-opacity duration-200' 
                                : 'opacity-0'
                    }`}
                    alt={movie.title}
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                    loading="lazy"
                    decoding="async"
                    style={showImmediately ? {} : { willChange: 'opacity' }}
                />
            </div>
        );
    }, (prevProps, nextProps) => {
        // Custom comparison: only re-render if movie data actually changed
        return prevProps.movie.id === nextProps.movie.id && 
               prevProps.movie.poster === nextProps.movie.poster &&
               prevProps.className === nextProps.className &&
               prevProps.useThumbnail === nextProps.useThumbnail;
    });

    // Show blocked screen if user is blocked
    if (isAuthenticatedState && isBlocked) {
        return <BlockedUserScreen onLogout={handleLogout} />;
    }

    // Show login/signup pages if not authenticated
    if (!isAuthenticatedState) {
        return showSignUp ? (
            <SignUpPage 
                onSignUpSuccess={handleSignUpSuccess}
                onSwitchToLogin={() => setShowSignUp(false)}
            />
        ) : (
            <LoginPage 
                onLoginSuccess={handleLoginSuccess}
                onSwitchToSignUp={() => setShowSignUp(true)}
            />
        );
    }

    return (
        <div className="flex min-h-screen bg-[#050505] text-white font-sans">

            {/* --- SABİT SIDEBAR --- */}
            <aside className="w-64 bg-[#0a192f] border-r border-gray-800 sticky top-0 h-screen flex flex-col z-50 overflow-hidden">
                <div className="p-6 flex-shrink-0">
                    <h1
                        onClick={() => setActivePage("home")}
                        className="text-3xl font-black text-white tracking-tighter mb-10 cursor-pointer hover:text-accent-red transition"
                    >
                        MOVİE<span className="text-accent-red">MATE</span>
                    </h1>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6">
                    <div className="flex flex-col gap-2">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">Kategoriler</p>
                        {genres.map(g => (
                            <button key={g}
                                    onClick={() => { setSelectedGenre(g); setActivePage("home"); }}
                                    className={`text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                                        selectedGenre === g && activePage === "home" ? 'bg-accent-red text-white' : 'text-gray-400 hover:bg-gray-800'
                                    }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 flex flex-col gap-2">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">Keşfet</p>
                        <button
                            onClick={() => setActivePage("special")}
                            className={`text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                                activePage === "special" ? 'bg-accent-red text-white shadow-lg shadow-red-900/40' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            ✨ Sana Özel
                        </button>
                    </div>
                </div>
            </aside>

            {/* --- ANA İÇERİK ALANI --- */}
            <main className="flex-1 p-8 relative">
                {/* Account Button - Bottom Right */}
                <div className="fixed bottom-4 right-4 z-40">
                    <div
                        onClick={() => setActivePage("profile")}
                        className={`cursor-pointer p-3 rounded-xl transition-all mb-2 ${activePage === "profile" ? 'bg-gray-800 border-2 border-accent-red' : 'bg-[#0a192f] border border-gray-800 hover:bg-gray-800'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-accent-red rounded-full flex items-center justify-center font-bold text-white">
                                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">{currentUser?.name || 'Kullanıcı'}</p>
                                <p className="text-[10px] text-gray-500">Profilim</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full bg-gray-800 hover:bg-red-600 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-all border border-gray-700"
                    >
                        Çıkış Yap
                    </button>
                </div>

                {activePage === "home" && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex justify-between items-center mb-10 gap-4">
                            <div className="relative w-full max-w-md group">
                                {/* LOGO: Emoji yerine gelen modern SVG ikon */}
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-colors group-focus-within:text-accent-red">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>

                                {/* INPUT: Search in TMDB */}
                                <input
                                    type="text"
                                    placeholder="Ara"
                                    className="w-full bg-gray-900/40 backdrop-blur-md border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-accent-red/50 focus:border-accent-red outline-none transition-all shadow-2xl text-white placeholder-gray-500"
                                    onChange={(e) => setSearch(e.target.value)}
                                    value={search}
                                />
                            </div>
                        </div>

                        <section>
                            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                                <h2 className="text-3xl font-bold flex items-center gap-3">
                                    <span className="w-2 h-8 bg-accent-red rounded-full"></span>
                                    {search && search.trim().length > 0 
                                        ? `Arama Sonuçları: "${search}"`
                                        : selectedGenre === "Tüm Filmler"
                                            ? "Tüm Filmler"
                                            : `${selectedGenre} Filmleri`
                                    }
                                </h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                                        {filteredMovies.length} {filteredMovies.length >= 20 ? 'film' : filteredMovies.length > 0 ? 'film' : 'film bulunamadı'}
                                    </span>
                                </div>
                            </div>
                            
                            {error && (
                                <div className="bg-red-500/20 border border-red-500 rounded-xl p-4 mb-6">
                                    <p className="text-red-400 text-sm">{error}</p>
                                    <button onClick={() => window.location.reload()} className="mt-2 text-xs text-red-300 underline">Sayfayı Yenile</button>
                                </div>
                            )}
                            
                            {tmdbLoading && (
                                <div className="text-center py-12">
                                    <p className="text-gray-400 italic">Yükleniyor...</p>
                                </div>
                            )}
                            
                            {!tmdbLoading && !error && filteredMovies.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-gray-400 italic">Film bulunamadı. Lütfen bir kategori seçin.</p>
                                </div>
                            )}
                            
                            {!tmdbLoading && filteredMovies.length > 0 && (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                                        {filteredMovies.map(movie => (
                                    <div key={movie.id} onClick={() => handleMovieClick(movie)} className={`bg-[#0a192f] rounded-xl overflow-hidden border group cursor-pointer hover:border-accent-red transition shadow-lg relative ${isMovieWatched(movie) ? 'border-green-600/50' : 'border-gray-800'}`}>
                                        {isMovieWatched(movie) && (
                                            <div className="absolute top-1 right-1 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold z-10">
                                                ✓
                                            </div>
                                        )}
                                        {getMovieRating(movie) && (isMovieWatched(movie) || favorites.find(m => m.id === movie.id)) && (
                                            <div className="absolute top-1 left-1 bg-yellow-500 text-black rounded-full px-1.5 py-0.5 text-[10px] font-bold z-10 flex items-center gap-0.5">
                                                ⭐ {typeof getMovieRating(movie) === 'number' ? getMovieRating(movie).toFixed(1) : getMovieRating(movie)}/5
                                            </div>
                                        )}
                                        <MoviePoster movie={movie} className="w-full aspect-[4/5] object-cover" />
                                        <div className="p-2">
                                            <h3 className="font-bold truncate text-sm mb-1">{movie.title}</h3>
                                            <div className="flex items-center justify-between gap-1 mb-1">
                                                <p className="text-[9px] text-gray-500 uppercase tracking-widest truncate">{movie.genre}</p>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); toggleFavorite(movie); }} 
                                                        className="p-1 hover:bg-gray-800 rounded transition-all group"
                                                        title={favorites.find(m => m.id === movie.id) ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                                                    >
                                                        <svg 
                                                            className={`w-4 h-4 transition-all ${favorites.find(m => m.id === movie.id) ? 'text-red-500 fill-red-500' : 'text-gray-400 group-hover:text-red-500'}`}
                                                            fill={favorites.find(m => m.id === movie.id) ? 'currentColor' : 'none'}
                                                            stroke="currentColor" 
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                        </svg>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); toggleWatched(movie); }} 
                                                        className="p-1 hover:bg-gray-800 rounded transition-all group"
                                                        title={isMovieWatched(movie) ? 'İzlenenlerden Çıkar' : 'İzlendi Olarak İşaretle'}
                                                    >
                                                        <svg 
                                                            className={`w-4 h-4 transition-all ${isMovieWatched(movie) ? 'text-green-500 fill-green-500' : 'text-gray-400 group-hover:text-green-500'}`}
                                                            fill={isMovieWatched(movie) ? 'currentColor' : 'none'}
                                                            stroke="currentColor" 
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); toggleWantToWatch(movie); }} 
                                                        className="p-1 hover:bg-gray-800 rounded transition-all group"
                                                        title={isMovieWantToWatch(movie) ? 'İzleme Listesinden Çıkar' : 'İzleme Listesine Ekle'}
                                                    >
                                                        <svg 
                                                            className={`w-4 h-4 transition-all ${isMovieWantToWatch(movie) ? 'text-blue-500 fill-blue-500' : 'text-gray-400 group-hover:text-blue-500'}`}
                                                            fill={isMovieWantToWatch(movie) ? 'currentColor' : 'none'}
                                                            stroke="currentColor" 
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                            </div>
                                        ))}
                                    </div>
                                    {isLoadingMore && (
                                        <div className="text-center py-8 mt-4">
                                            <p className="text-gray-400 italic">Yükleniyor...</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    </div>
                )}

                {activePage === "profile" && (
                    <div className="animate-in slide-in-from-left duration-500 max-w-4xl">
                        <h2 className="text-5xl font-black mb-8">Hesabım</h2>
                        <div className="bg-[#0a192f] p-8 rounded-[2.5rem] border border-gray-800 flex items-center gap-8 mb-8">
                            <div className="w-24 h-24 bg-accent-red rounded-3xl flex items-center justify-center text-4xl font-black">
                                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white">{currentUser?.name || 'Kullanıcı'}</h3>
                                <p className="text-gray-500 font-medium italic">{currentUser?.email || ''}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-[#0a192f] p-6 rounded-3xl border border-gray-800">
                                <h4 className="font-bold mb-4 text-accent-red flex items-center gap-2">
                                    <svg className="w-5 h-5 fill-red-500" viewBox="0 0 24 24">
                                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    FAVORİLERİM ({favorites.length})
                                </h4>
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {favorites.length > 0 ? favorites.map(m => (
                                        <div key={m.id} className="flex justify-between items-center bg-black/30 p-3 rounded-xl">
                                            <span className="text-sm font-semibold">{m.title}</span>
                                            <button onClick={() => toggleFavorite(m)} className="text-xs text-gray-500 hover:text-red-500 transition">Kaldır</button>
                                        </div>
                                    )) : <p className="text-gray-600 text-sm">Listeniz boş.</p>}
                                </div>
                            </div>
                            
                            <div className="bg-[#0a192f] p-6 rounded-3xl border border-gray-800">
                                <h4 className="font-bold mb-4 text-green-500">✓ İZLEDİĞİM FİLMLER ({watchedMovies.length})</h4>
                                <WatchedMoviesList 
                                    watchedMovieIds={watchedMovies}
                                    allMovies={[...tmdbMovies, ...favorites, ...recommendedMovies]}
                                    getMovieRating={getMovieRating}
                                    toggleWatched={toggleWatched}
                                />
                                {watchedMovies.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-800">
                                        <p className="text-xs text-gray-500">
                                            Ortalama Puanınız: <span className="text-yellow-400 font-bold">{getAverageUserRating()}/5</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="mt-8 bg-[#0a192f] p-6 rounded-3xl border border-gray-800">
                            <h4 className="font-bold mb-4 text-blue-500 flex items-center gap-2">
                                <svg className="w-5 h-5 fill-blue-500" viewBox="0 0 24 24">
                                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                                İZLEMEK İSTEDİKLERİM ({wantToWatchMovies.length})
                            </h4>
                            <WantToWatchList 
                                wantToWatchMovieIds={wantToWatchMovies}
                                allMovies={[...tmdbMovies, ...favorites, ...recommendedMovies]}
                                toggleWantToWatch={toggleWantToWatch}
                            />
                        </div>
                    </div>
                )}

                {activePage === "special" && (
                    <div className="animate-in fade-in duration-500">
                        <div className="mb-4">
                            <h2 className="text-4xl font-black mb-2">✨ Sana Özel</h2>
                            <p className="text-gray-500 font-medium">Beğendiğin türlere dayanarak hazırlanan kişisel seçkin.</p>
                        </div>
                        
                        {recommendationLoading && (
                            <div className="bg-[#0a192f] p-16 rounded-[3rem] border border-gray-800 text-center">
                                <p className="text-gray-400 italic">Yükleniyor...</p>
                            </div>
                        )}
                        
                        {!recommendationLoading && favorites.length > 0 ? (
                            recommendedMovies.length > 0 ? (
                                <>
                                    <p className="text-xs text-gray-500 mb-4">
                                        TMDB'den özel öneriler ({recommendedMovies.length} film)
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {recommendedMovies.map(movie => (
                                            <div key={movie.id} onClick={() => handleMovieClick(movie)} className={`bg-[#0a192f] rounded-2xl overflow-hidden border group cursor-pointer hover:border-accent-red transition shadow-lg relative ${isMovieWatched(movie) ? 'border-green-600/50' : 'border-gray-800'}`}>
                                                {isMovieWatched(movie) && (
                                                    <div className="absolute top-2 right-2 bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold z-10">
                                                        ✓
                                                    </div>
                                                )}
                                                {getMovieRating(movie) && (isMovieWatched(movie) || favorites.find(m => m.id === movie.id)) && (
                                                    <div className="absolute top-2 left-2 bg-yellow-500 text-black rounded-full px-2 py-1 text-xs font-bold z-10 flex items-center gap-1">
                                                        ⭐ {typeof getMovieRating(movie) === 'number' ? getMovieRating(movie).toFixed(1) : getMovieRating(movie)}/5
                                                    </div>
                                                )}
                                                <MoviePoster movie={movie} className="w-full aspect-[2/3] object-cover" />
                                                <div className="p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h3 className="font-bold truncate flex-1">{movie.title}</h3>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); toggleFavorite(movie); }} 
                                                            className="flex-shrink-0 ml-2 p-2 hover:bg-gray-800 rounded-lg transition-all group"
                                                            title={favorites.find(m => m.id === movie.id) ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
                                                        >
                                                            <svg 
                                                                className={`w-5 h-5 transition-all ${favorites.find(m => m.id === movie.id) ? 'text-red-500 fill-red-500 scale-110' : 'text-gray-400 group-hover:text-red-500'}`}
                                                                fill={favorites.find(m => m.id === movie.id) ? 'currentColor' : 'none'}
                                                                stroke="currentColor" 
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest">{movie.genre}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="bg-[#0a192f] p-16 rounded-[3rem] border border-dashed border-gray-800 text-center">
                                    <p className="text-gray-400 italic">Şu an için yeni bir önerimiz yok. Daha fazla film favorileyerek zevkini bize öğretebilirsin!</p>
                                </div>
                            )
                        ) : !recommendationLoading ? (
                            <div className="bg-[#0a192f] p-16 rounded-[3rem] border border-gray-800 text-center">
                                <p className="text-xl font-bold mb-4">Hala Sizi Tanımaya Çalışıyoruz</p>
                                <p className="text-gray-500 mb-8 italic text-sm">Size özel öneriler sunabilmemiz için birkaç filmi favorilerinize eklemeniz gerekiyor.</p>
                                <button onClick={() => setActivePage("home")} className="bg-accent-red px-10 py-3 rounded-2xl font-black shadow-lg shadow-red-900/40 text-white hover:bg-red-700 transition">Keşfe Başla</button>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* 3. SAYFA: FİLM DETAY (REVİZE EDİLDİ) */}
                {activePage === "detail" && selectedMovie && (
                    <div className="animate-in fade-in zoom-in-95 duration-500 max-w-6xl mx-auto text-white">
                        <button onClick={() => setActivePage("home")} className="mb-8 text-gray-500 hover:text-white transition flex items-center gap-2">← Geri Dön</button>
                        <div className="flex flex-col md:flex-row gap-12">
                            <MoviePoster movie={selectedMovie} className="w-full md:w-44 md:h-[28rem] rounded-[2.5rem] shadow-2xl border border-gray-800 flex-shrink-0" useThumbnail={false} />
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-6">
                                    <h2 className="text-6xl font-black tracking-tighter leading-none">{selectedMovie.title}</h2>
                                    <div className="bg-yellow-500 text-black font-black px-4 py-2 rounded-2xl">⭐ {selectedMovie.imdb || "8.5"}</div>
                                </div>

                                {/* YIL VE TÜRLERE BURADAN ERİŞİLEBİLİR */}
                                <div className="flex gap-2 mb-8 flex-wrap">
                                    {/* Primary genre (always shown) */}
                                    {selectedMovie.genre && (
                                        <span className="bg-accent-red/20 text-accent-red px-4 py-1 rounded-full text-xs font-bold uppercase border border-accent-red/30">
                                            {selectedMovie.genre}
                                        </span>
                                    )}
                                    {/* Second genre (if available) */}
                                    {selectedMovie.genres && selectedMovie.genres.length > 1 && (
                                        <span className="bg-blue-500/20 text-blue-400 px-4 py-1 rounded-full text-xs font-bold uppercase border border-blue-500/30">
                                            {selectedMovie.genres[1]}
                                        </span>
                                    )}
                                    {/* Third genre (if available) */}
                                    {selectedMovie.genres && selectedMovie.genres.length > 2 && (
                                        <span className="bg-purple-500/20 text-purple-400 px-4 py-1 rounded-full text-xs font-bold uppercase border border-purple-500/30">
                                            {selectedMovie.genres[2]}
                                        </span>
                                    )}
                                    <span className="bg-gray-800 text-white px-4 py-1 rounded-full text-xs font-bold border border-gray-700">
                                        {selectedMovie.year}
                                    </span>
                                </div>

                                <p className="text-xl text-gray-400 mb-10 leading-relaxed italic">"{selectedMovie.summary}"</p>

                                {/* Kullanıcı Puanlama Bölümü */}
                                <div className="mb-10 p-6 bg-[#0a192f] rounded-2xl border border-gray-800">
                                    <h3 className="text-lg font-bold mb-4 text-white">Filmi Puanla</h3>
                                    <div className="flex items-center gap-4 mb-4">
                                        <StarRating 
                                            rating={getMovieRating(selectedMovie) || 0} 
                                            onRatingChange={(rating) => handleRating(selectedMovie, rating)}
                                        />
                                    </div>
                                    {getMovieRating(selectedMovie) && (
                                        <p className="text-sm text-gray-400">
                                            Puanınız: <span className="text-yellow-400 font-bold">{typeof getMovieRating(selectedMovie) === 'number' ? getMovieRating(selectedMovie).toFixed(1) : getMovieRating(selectedMovie)}/5</span>
                                        </p>
                                    )}
                                </div>

                                {/* BİLGİ TABLOSUNA YIL EKLENDİ (Grid-cols-3 yapıldı) */}
                                <div className="grid grid-cols-3 gap-8 border-t border-gray-800 pt-8">
                                    <div>
                                        <p className="text-gray-500 text-xs font-bold uppercase mb-2">Yıl</p>
                                        <p className="text-xl font-bold">{selectedMovie.year || "Bilinmiyor"}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs font-bold uppercase mb-2">Yönetmen</p>
                                        <p className="text-xl font-bold">{selectedMovie.director || "Bilinmiyor"}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs font-bold uppercase mb-2">Oyuncular</p>
                                        <p className="text-lg font-semibold text-gray-300">{(selectedMovie.cast && selectedMovie.cast.join(', ')) || "Bilinmiyor"}</p>
                                    </div>
                                </div>

                                {/* Where to Watch Section */}
                                {watchProviders !== null && (
                                    <div className="mt-10 p-6 bg-[#0a192f] rounded-2xl border border-gray-800">
                                        <h3 className="text-lg font-bold mb-6 text-white">Nerede İzlenir</h3>
                                        {watchProviders && (watchProviders.flatrate?.length > 0 || watchProviders.rent?.length > 0 || watchProviders.buy?.length > 0) ? (
                                            <div className="space-y-6">
                                                {watchProviders.flatrate && watchProviders.flatrate.length > 0 && (
                                                    <div>
                                                        <p className="text-gray-500 text-xs font-bold uppercase mb-3">Abonelik</p>
                                                        <div className="flex flex-wrap gap-3">
                                                            {watchProviders.flatrate.map((provider) => (
                                                                <div
                                                                    key={provider.provider_id}
                                                                    className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-xl border border-gray-700 hover:border-accent-red/50 transition"
                                                                    title={provider.provider_name}
                                                                >
                                                                    {provider.logo_path && (
                                                                        <img
                                                                            src={getImageUrl(provider.logo_path)}
                                                                            alt={provider.provider_name}
                                                                            className="w-8 h-8 object-contain"
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <span className="text-sm font-semibold text-gray-300">{provider.provider_name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {watchProviders.rent && watchProviders.rent.length > 0 && (
                                                    <div>
                                                        <p className="text-gray-500 text-xs font-bold uppercase mb-3">Kirala</p>
                                                        <div className="flex flex-wrap gap-3">
                                                            {watchProviders.rent.map((provider) => (
                                                                <div
                                                                    key={provider.provider_id}
                                                                    className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-xl border border-gray-700 hover:border-accent-red/50 transition"
                                                                    title={provider.provider_name}
                                                                >
                                                                    {provider.logo_path && (
                                                                        <img
                                                                            src={getImageUrl(provider.logo_path)}
                                                                            alt={provider.provider_name}
                                                                            className="w-8 h-8 object-contain"
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <span className="text-sm font-semibold text-gray-300">{provider.provider_name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {watchProviders.buy && watchProviders.buy.length > 0 && (
                                                    <div>
                                                        <p className="text-gray-500 text-xs font-bold uppercase mb-3">Satın Al</p>
                                                        <div className="flex flex-wrap gap-3">
                                                            {watchProviders.buy.map((provider) => (
                                                                <div
                                                                    key={provider.provider_id}
                                                                    className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-xl border border-gray-700 hover:border-accent-red/50 transition"
                                                                    title={provider.provider_name}
                                                                >
                                                                    {provider.logo_path && (
                                                                        <img
                                                                            src={getImageUrl(provider.logo_path)}
                                                                            alt={provider.provider_name}
                                                                            className="w-8 h-8 object-contain"
                                                                            onError={(e) => {
                                                                                e.target.style.display = 'none';
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <span className="text-sm font-semibold text-gray-300">{provider.provider_name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 text-sm">Bu film için mevcut izleme seçenekleri bulunmamaktadır.</p>
                                        )}
                                    </div>
                                )}

                                <div className="mt-12 flex gap-4 flex-wrap items-center">
                                    <button 
                                        onClick={() => toggleFavorite(selectedMovie)} 
                                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg group ${
                                            favorites.find(m => m.id === selectedMovie.id) 
                                                ? 'bg-red-500/20 text-red-500 border-2 border-red-500 hover:bg-red-500/30' 
                                                : 'bg-gray-700 text-white hover:bg-gray-600 border-2 border-gray-600'
                                        }`}
                                    >
                                        <svg 
                                            className={`w-6 h-6 transition-all ${favorites.find(m => m.id === selectedMovie.id) ? 'fill-red-500 scale-110' : 'group-hover:scale-110'}`}
                                            fill={favorites.find(m => m.id === selectedMovie.id) ? 'currentColor' : 'none'}
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                        </svg>
                                        <span>{favorites.find(m => m.id === selectedMovie.id) ? 'Favorilerde' : 'Favorilere Ekle'}</span>
                                    </button>
                                    <button 
                                        onClick={() => toggleWantToWatch(selectedMovie)} 
                                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg ${
                                            isMovieWantToWatch(selectedMovie)
                                                ? 'bg-blue-500/20 text-blue-500 border-2 border-blue-500 hover:bg-blue-500/30'
                                                : 'bg-gray-700 text-white hover:bg-gray-600 border-2 border-gray-600'
                                        }`}
                                    >
                                        <svg 
                                            className={`w-6 h-6 transition-all ${isMovieWantToWatch(selectedMovie) ? 'fill-blue-500' : 'fill-none'}`}
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                        </svg>
                                        <span>{isMovieWantToWatch(selectedMovie) ? 'İzleme Listesinde' : 'İzleme Listesine Ekle'}</span>
                                    </button>
                                    <button 
                                        onClick={() => toggleWatched(selectedMovie)} 
                                        className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg ${
                                            isMovieWatched(selectedMovie)
                                                ? 'bg-green-600 text-white hover:bg-green-700'
                                                : 'bg-gray-700 text-white hover:bg-gray-600'
                                        }`}
                                    >
                                        <svg 
                                            className={`w-6 h-6 transition-all ${isMovieWatched(selectedMovie) ? 'fill-white' : 'fill-none'}`}
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{isMovieWatched(selectedMovie) ? '✓ İzledim' : 'İzledim'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            
            {/* Onboarding Modal */}
            {showOnboarding && (
                <OnboardingModal
                    movies={onboardingMovies}
                    onComplete={handleOnboardingComplete}
                    onClose={() => setShowOnboarding(false)}
                />
            )}
        </div>
    );
}

export default App;