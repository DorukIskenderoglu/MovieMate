// TMDB API Configuration
const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Get API key from environment variable or use provided fallback
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || 'd7b3fe96587388125aeeae07f286ee60';

// Rate limiting: Maximum requests per second
const RATE_LIMIT_REQUESTS = 40; // TMDB allows 40 requests per 10 seconds
const RATE_LIMIT_WINDOW = 10000; // 10 seconds in milliseconds

// Genre mapping: Local genres to TMDB genre IDs
export const GENRE_MAP = {
    "Bilim Kurgu": [878, 14],      // Science Fiction + Fantasy (Fantasy maps to Bilim Kurgu)
    "Komedi": 35,            // Comedy
    "Aksiyon/Macera": [28, 12], // Action or Adventure (merged category)
    "Animasyon": 16,         // Animation
    "Suç": 80,               // Crime
    "Drama": [18, 10749],    // Drama + Romance (Romance maps to Drama)
    "Gizem": [9648, 53],     // Mystery + Thriller (Thriller maps to Gizem)
    "Belgesel": 99,          // Documentary
    "Korku": 27,             // Horror
    "Tüm Filmler": null
};

// TMDB API endpoints
export const TMDB_ENDPOINTS = {
    SEARCH_MOVIE: '/search/movie',
    DISCOVER_MOVIE: '/discover/movie',
    MOVIE_DETAILS: '/movie',
    SEARCH_PERSON: '/search/person',
    PERSON_MOVIES: '/person',
    GENRE_LIST: '/genre/movie/list',
    WATCH_PROVIDERS: '/movie/{id}/watch/providers'
};

// Rate limiting tracker
let requestQueue = [];
let requestCount = 0;
let windowStart = Date.now();

/**
 * Check and enforce rate limiting
 */
export async function checkRateLimit() {
    const now = Date.now();
    
    // Reset window if 10 seconds have passed
    if (now - windowStart > RATE_LIMIT_WINDOW) {
        requestCount = 0;
        windowStart = now;
    }
    
    // If we've hit the limit, wait
    if (requestCount >= RATE_LIMIT_REQUESTS) {
        const waitTime = RATE_LIMIT_WINDOW - (now - windowStart);
        if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            requestCount = 0;
            windowStart = Date.now();
        }
    }
    
    requestCount++;
}

/**
 * Get API key
 */
export function getApiKey() {
    if (!TMDB_API_KEY) {
        console.warn('TMDB API key not found. Set VITE_TMDB_API_KEY in .env file');
        return null;
    }
    return TMDB_API_KEY;
}

/**
 * Get full API URL for an endpoint
 */
export function getApiUrl(endpoint, params = {}) {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    
    const url = new URL(`${TMDB_API_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('language', 'en-US'); // English language
    
    // Add additional params
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.set(key, params[key]);
        }
    });
    
    return url.toString();
}

/**
 * Get image URL with configurable size
 * @param {string} posterPath - The poster path from TMDB
 * @param {string} size - Image size: 'w300' (thumbnail), 'w500' (default), 'w780' (large)
 * @returns {string|null} Full image URL or null
 */
export function getImageUrl(posterPath, size = 'w500') {
    if (!posterPath) return null;
    if (posterPath.startsWith('http')) return posterPath;
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

/**
 * Get thumbnail URL (smaller, faster loading for grid views)
 * Uses w300 size which is ~50% smaller than w500
 */
export function getThumbnailUrl(posterPath) {
    return getImageUrl(posterPath, 'w300');
}

export default {
    TMDB_API_BASE_URL,
    TMDB_IMAGE_BASE_URL,
    GENRE_MAP,
    TMDB_ENDPOINTS,
    getApiKey,
    getApiUrl,
    getImageUrl,
    checkRateLimit
};

