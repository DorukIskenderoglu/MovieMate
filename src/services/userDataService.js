// User Data Service - Manages watched movies and user ratings in localStorage

// Legacy keys for backward compatibility
const LEGACY_WATCHED_STORAGE_KEY = 'movieMate_watched';
const LEGACY_RATINGS_STORAGE_KEY = 'movieMate_ratings';
const LEGACY_WANT_TO_WATCH_STORAGE_KEY = 'movieMate_wantToWatch';
const LEGACY_FAVORITES_STORAGE_KEY = 'movieMate_favorites';

/**
 * Get storage key for user-specific data
 */
function getStorageKey(baseKey, userId) {
    if (!userId) {
        // Fallback to legacy key if no userId provided
        return baseKey;
    }
    return `${baseKey}_${userId}`;
}

/**
 * Migrate legacy data to user-specific storage
 */
export function migrateLegacyDataToUser(userId) {
    if (!userId) return false;
    
    try {
        // Check if migration already done
        const migrationKey = `movieMate_migrated_${userId}`;
        if (localStorage.getItem(migrationKey)) {
            return true; // Already migrated
        }

        // Migrate watched movies
        const legacyWatched = localStorage.getItem(LEGACY_WATCHED_STORAGE_KEY);
        if (legacyWatched) {
            const watched = JSON.parse(legacyWatched);
            const watchedArray = Array.isArray(watched) ? watched : Object.keys(watched);
            if (watchedArray.length > 0) {
                localStorage.setItem(getStorageKey('movieMate_watched', userId), JSON.stringify(watchedArray));
            }
        }

        // Migrate ratings
        const legacyRatings = localStorage.getItem(LEGACY_RATINGS_STORAGE_KEY);
        if (legacyRatings) {
            localStorage.setItem(getStorageKey('movieMate_ratings', userId), legacyRatings);
        }

        // Migrate want to watch
        const legacyWantToWatch = localStorage.getItem(LEGACY_WANT_TO_WATCH_STORAGE_KEY);
        if (legacyWantToWatch) {
            const wantToWatch = JSON.parse(legacyWantToWatch);
            const wantToWatchArray = Array.isArray(wantToWatch) ? wantToWatch : Object.keys(wantToWatch);
            if (wantToWatchArray.length > 0) {
                localStorage.setItem(getStorageKey('movieMate_wantToWatch', userId), JSON.stringify(wantToWatchArray));
            }
        }

        // Migrate favorites (if stored in localStorage)
        const legacyFavorites = localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY);
        if (legacyFavorites) {
            const favorites = JSON.parse(legacyFavorites);
            if (Array.isArray(favorites) && favorites.length > 0) {
                localStorage.setItem(getStorageKey('movieMate_favorites', userId), JSON.stringify(favorites));
            }
        }

        // Mark migration as done
        localStorage.setItem(migrationKey, 'true');
        return true;
    } catch (error) {
        console.error('Error migrating legacy data:', error);
        return false;
    }
}

/**
 * Get watched movies from localStorage
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function getWatchedMovies(userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return [];
        }
        const storageKey = getStorageKey('movieMate_watched', userId);
        const data = localStorage.getItem(storageKey);
        if (!data) return [];
        const watched = JSON.parse(data);
        // Convert object to array of IDs, or return array if already array
        return Array.isArray(watched) ? watched : Object.keys(watched);
    } catch (error) {
        console.error('Error loading watched movies:', error);
        return [];
    }
}

/**
 * Mark a movie as watched
 * @param {string} movieId - Movie ID
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function setWatchedMovie(movieId, userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        const watched = getWatchedMovies(userId);
        if (!watched.includes(movieId)) {
            watched.push(movieId);
            const storageKey = getStorageKey('movieMate_watched', userId);
            localStorage.setItem(storageKey, JSON.stringify(watched));
        }
        return true;
    } catch (error) {
        console.error('Error saving watched movie:', error);
        return false;
    }
}

/**
 * Remove a movie from watched list
 * @param {string} movieId - Movie ID
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function removeWatchedMovie(movieId, userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        const watched = getWatchedMovies(userId);
        const filtered = watched.filter(id => id !== movieId);
        const storageKey = getStorageKey('movieMate_watched', userId);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error removing watched movie:', error);
        return false;
    }
}

/**
 * Check if a movie is watched
 * @param {string} movieId - Movie ID
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function isWatched(movieId, userId = null) {
    const watched = getWatchedMovies(userId);
    return watched.includes(movieId);
}

/**
 * Get user rating for a movie
 * @param {string} movieId - Movie ID
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function getUserRating(movieId, userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return null;
        }
        const storageKey = getStorageKey('movieMate_ratings', userId);
        const data = localStorage.getItem(storageKey);
        if (!data) return null;
        const ratings = JSON.parse(data);
        return ratings[movieId] || null;
    } catch (error) {
        console.error('Error loading user rating:', error);
        return null;
    }
}

/**
 * Set user rating for a movie (0.5-5 scale)
 * @param {string} movieId - Movie ID
 * @param {number} rating - Rating value (0.5-5)
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function setUserRating(movieId, rating, userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        if (rating < 0.5 || rating > 5) {
            console.error('Rating must be between 0.5 and 5');
            return false;
        }
        
        const storageKey = getStorageKey('movieMate_ratings', userId);
        const data = localStorage.getItem(storageKey);
        const ratings = data ? JSON.parse(data) : {};
        ratings[movieId] = rating;
        localStorage.setItem(storageKey, JSON.stringify(ratings));
        return true;
    } catch (error) {
        console.error('Error saving user rating:', error);
        return false;
    }
}

/**
 * Get all user ratings
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function getAllUserRatings(userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return {};
        }
        const storageKey = getStorageKey('movieMate_ratings', userId);
        const data = localStorage.getItem(storageKey);
        if (!data) return {};
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading all ratings:', error);
        return {};
    }
}

/**
 * Get want to watch movies from localStorage
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function getWantToWatchMovies(userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return [];
        }
        const storageKey = getStorageKey('movieMate_wantToWatch', userId);
        const data = localStorage.getItem(storageKey);
        if (!data) return [];
        const wantToWatch = JSON.parse(data);
        return Array.isArray(wantToWatch) ? wantToWatch : Object.keys(wantToWatch);
    } catch (error) {
        console.error('Error loading want to watch movies:', error);
        return [];
    }
}

/**
 * Mark a movie as want to watch
 * @param {string} movieId - Movie ID
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function setWantToWatchMovie(movieId, userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        const wantToWatch = getWantToWatchMovies(userId);
        if (!wantToWatch.includes(movieId)) {
            wantToWatch.push(movieId);
            const storageKey = getStorageKey('movieMate_wantToWatch', userId);
            localStorage.setItem(storageKey, JSON.stringify(wantToWatch));
        }
        return true;
    } catch (error) {
        console.error('Error saving want to watch movie:', error);
        return false;
    }
}

/**
 * Remove a movie from want to watch list
 * @param {string} movieId - Movie ID
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function removeWantToWatchMovie(movieId, userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        const wantToWatch = getWantToWatchMovies(userId);
        const filtered = wantToWatch.filter(id => id !== movieId);
        const storageKey = getStorageKey('movieMate_wantToWatch', userId);
        localStorage.setItem(storageKey, JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.error('Error removing want to watch movie:', error);
        return false;
    }
}

/**
 * Check if a movie is in want to watch list
 * @param {string} movieId - Movie ID
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function isWantToWatch(movieId, userId = null) {
    const wantToWatch = getWantToWatchMovies(userId);
    return wantToWatch.includes(movieId);
}

/**
 * Get user favorites from localStorage
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function getFavorites(userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return [];
        }
        const storageKey = getStorageKey('movieMate_favorites', userId);
        const data = localStorage.getItem(storageKey);
        if (!data) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading favorites:', error);
        return [];
    }
}

/**
 * Save user favorites to localStorage
 * @param {Array} favorites - Array of favorite movies
 * @param {string} userId - Optional user ID. If not provided, uses legacy key.
 */
export function setFavorites(favorites, userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        const storageKey = getStorageKey('movieMate_favorites', userId);
        localStorage.setItem(storageKey, JSON.stringify(favorites));
        return true;
    } catch (error) {
        console.error('Error saving favorites:', error);
        return false;
    }
}

/**
 * Check if user has completed onboarding
 * @param {string} userId - User ID
 */
export function isFirstTimeUser(userId) {
    if (!userId) return true; // If no userId, treat as first-time user
    
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return true;
        }
        const onboardingKey = `movieMate_onboarding_complete_${userId}`;
        const completed = localStorage.getItem(onboardingKey);
        return !completed || completed !== 'true';
    } catch (error) {
        console.error('Error checking onboarding status:', error);
        return true; // Default to first-time user on error
    }
}

/**
 * Mark onboarding as complete for a user
 * @param {string} userId - User ID
 */
export function setOnboardingComplete(userId) {
    if (!userId) return false;
    
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        const onboardingKey = `movieMate_onboarding_complete_${userId}`;
        localStorage.setItem(onboardingKey, 'true');
        return true;
    } catch (error) {
        console.error('Error marking onboarding complete:', error);
        return false;
    }
}

/**
 * Clear all user data from localStorage
 * This removes all watched movies, ratings, want to watch lists, favorites, onboarding data, and authentication data
 * When called without userId, clears ALL data including all users and sessions
 * @param {string} userId - Optional user ID. If provided, only clears data for that user. If null, clears all user data including auth.
 */
export function clearAllUserData(userId = null) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        
        if (userId) {
            // Clear data for specific user
            localStorage.removeItem(getStorageKey('movieMate_watched', userId));
            localStorage.removeItem(getStorageKey('movieMate_ratings', userId));
            localStorage.removeItem(getStorageKey('movieMate_wantToWatch', userId));
            localStorage.removeItem(getStorageKey('movieMate_favorites', userId));
            localStorage.removeItem(`movieMate_onboarding_complete_${userId}`);
            localStorage.removeItem(`movieMate_migrated_${userId}`);
        } else {
            // Clear all user data (including legacy keys)
            // Get all localStorage keys
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('movieMate_')) {
                    keysToRemove.push(key);
                }
            }
            
            // Remove all movieMate keys
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
        
        return true;
    } catch (error) {
        console.error('Error clearing user data:', error);
        return false;
    }
}

