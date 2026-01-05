import { searchMoviesByGenre, searchMoviesByDirector, searchMoviesByActor, mergeLocalAndAPIResults, normalizeLocalToAPI } from './movieApiService.js';
import { GENRE_MAP } from '../config/api.js';

// Cache for extracted preferences (memoization)
const preferencesCache = new Map();

/**
 * Pre-compute preferences into Sets for O(1) lookups instead of O(n) array searches
 * ENHANCED: Includes frequency data for weighted scoring
 */
function precomputePreferences(preferences) {
    return {
        genres: new Set(preferences.genres.map(g => normalizeString(g))),
        directors: new Set(preferences.directors.map(d => normalizeString(d))),
        actors: new Set(preferences.actors.map(a => normalizeString(a))),
        minRating: preferences.minRating,
        userAvgRating: preferences.userAvgRating || null,
        genreFrequency: preferences.genreFrequency || {},
        directorFrequency: preferences.directorFrequency || {},
        actorFrequency: preferences.actorFrequency || {}
    };
}

/**
 * Extract user preferences from favorites and watched movies
 * Now with memoization for faster repeated calls
 * ENHANCED: Includes user ratings and frequency weighting for better accuracy
 */
export function extractUserPreferences(favorites = [], watchedMovies = [], allMovies = [], userRatings = {}) {
    // Create cache key based on favorites, watched movies, and user ratings
    const cacheKey = JSON.stringify({
        favIds: (favorites || []).map(f => f.id).sort(),
        watchedIds: watchedMovies.map(m => typeof m === 'object' && m.id ? m.id : m).sort(),
        ratingKeys: Object.keys(userRatings || {}).sort()
    });
    
    // Check cache first
    if (preferencesCache.has(cacheKey)) {
        return preferencesCache.get(cacheKey);
    }
    // Combine favorites and watched movies for preference extraction
    // Handle watchedMovies as either array of IDs or array of movie objects
    const watchedMoviesData = watchedMovies
        .map(item => {
            // If it's already a movie object, use it
            if (typeof item === 'object' && item.title) {
                return item;
            }
            // Otherwise, treat as ID and look up in allMovies
            return allMovies.find(m => m.id === item || m.tmdbId === item);
        })
        .filter(Boolean);
    
    const allUserMovies = [...(favorites || []), ...watchedMoviesData];
    
    if (!allUserMovies || allUserMovies.length === 0) {
        return {
            genres: [],
            directors: [],
            actors: [],
            minRating: 0
        };
    }
    
    // Combine genres from both favorites and watched movies
    const genres = [...new Set(allUserMovies.map(movie => movie.genre).filter(Boolean))];
    
    // Combine directors from both sources
    const directors = [...new Set(allUserMovies.map(movie => movie.director).filter(Boolean))];
    
    // Combine actors from both sources
    const actors = new Set();
    allUserMovies.forEach(movie => {
        if (movie.cast && Array.isArray(movie.cast)) {
            movie.cast.forEach(actor => actors.add(actor));
        }
    });
    
    // ENHANCED: Calculate frequency weights for better accuracy
    const genreFrequency = {};
    const directorFrequency = {};
    const actorFrequency = {};
    
    allUserMovies.forEach(movie => {
        if (movie.genre) {
            genreFrequency[movie.genre] = (genreFrequency[movie.genre] || 0) + 1;
        }
        if (movie.director) {
            directorFrequency[movie.director] = (directorFrequency[movie.director] || 0) + 1;
        }
        if (movie.cast && Array.isArray(movie.cast)) {
            movie.cast.forEach(actor => {
                actorFrequency[actor] = (actorFrequency[actor] || 0) + 1;
            });
        }
    });
    
    // Calculate average rating from both favorites and watched movies
    // Weight favorites slightly more (1.5x) since they're explicitly liked
    const favoriteRatings = (favorites || [])
        .map(fav => parseFloat(fav.imdb))
        .filter(rating => !isNaN(rating) && rating > 0)
        .map(r => r * 1.5); // Weight favorites more
    
    const watchedRatings = watchedMoviesData
        .map(movie => parseFloat(movie.imdb))
        .filter(rating => !isNaN(rating) && rating > 0);
    
    const allRatings = [...favoriteRatings, ...watchedRatings];
    const avgRating = allRatings.length > 0 
        ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length 
        : 8.0;
    
    // Remove weight factor from average for threshold calculation
    const normalizedAvgRating = favoriteRatings.length > 0 && watchedRatings.length > 0
        ? (favoriteRatings.reduce((sum, r) => sum + r, 0) / 1.5 + watchedRatings.reduce((sum, r) => sum + r, 0)) / (favoriteRatings.length / 1.5 + watchedRatings.length)
        : avgRating;
    
    // ENHANCED: Calculate user's average rating from their own ratings (more accurate!)
    const userRatingValues = Object.values(userRatings || {})
        .filter(rating => typeof rating === 'number' && rating >= 0.5 && rating <= 5);
    
    const userAvgRating = userRatingValues.length > 0
        ? userRatingValues.reduce((sum, r) => sum + r, 0) / userRatingValues.length
        : null;
    
    // Use user's average rating if available, otherwise use IMDB average
    const effectiveAvgRating = userAvgRating || normalizedAvgRating;
    
    const minRating = Math.max(7.5, effectiveAvgRating - 0.5); // Use user's preference, but minimum 7.5
    
    const preferences = {
        genres,
        directors: Array.from(directors),
        actors: Array.from(actors),
        minRating,
        userAvgRating: effectiveAvgRating, // User's actual rating preference
        genreFrequency, // Frequency of each genre in user's favorites
        directorFrequency, // Frequency of each director in user's favorites
        actorFrequency // Frequency of each actor in user's favorites
    };
    
    // Cache the result
    preferencesCache.set(cacheKey, preferences);
    
    return preferences;
}

/**
 * Normalize strings for comparison
 */
function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

/**
 * Check if genres match (optimized with Set lookup)
 */
function genresMatch(movieGenre, precomputedGenres) {
    if (!movieGenre || precomputedGenres.size === 0) return false;
    const normalizedMovieGenre = normalizeString(movieGenre);
    return precomputedGenres.has(normalizedMovieGenre);
}

/**
 * Check if director matches (optimized with Set lookup)
 */
function directorMatches(movieDirector, precomputedDirectors) {
    if (!movieDirector || precomputedDirectors.size === 0) return false;
    const normalizedMovieDirector = normalizeString(movieDirector);
    return precomputedDirectors.has(normalizedMovieDirector);
}

/**
 * Check if any actor matches (optimized with Set lookup)
 */
function actorMatches(movieCast, precomputedActors) {
    if (!movieCast || !Array.isArray(movieCast) || movieCast.length === 0) return false;
    if (precomputedActors.size === 0) return false;
    
    const normalizedCast = new Set(movieCast.map(actor => normalizeString(actor)));
    // Check if any favorite actor is in the cast
    for (const actor of precomputedActors) {
        if (normalizedCast.has(actor)) {
            return true;
        }
    }
    return false;
}

/**
 * Get rating from movie (handles both IMDB string and number)
 */
function getMovieRating(movie) {
    if (movie.imdb) {
        const rating = parseFloat(movie.imdb);
        if (!isNaN(rating)) return rating;
    }
    if (movie.vote_average) {
        return parseFloat(movie.vote_average);
    }
    return 0;
}

/**
 * Calculate recommendation score for a single movie
 * ENHANCED: Now includes multiple matches bonus, rating proximity, recency, and frequency weighting
 */
export function calculateRecommendationScore(movie, precomputedPrefs) {
    let score = 0;
    const rating = getMovieRating(movie);
    
    const genreMatch = genresMatch(movie.genre, precomputedPrefs.genres);
    const directorMatch = directorMatches(movie.director, precomputedPrefs.directors);
    const actorMatch = actorMatches(movie.cast, precomputedPrefs.actors);
    
    let matchCount = 0;
    
    // Priority 1: Genre match + High score (>= 8.0) with frequency weighting
    if (genreMatch) {
        matchCount++;
        const genreWeight = precomputedPrefs.genreFrequency?.[movie.genre] || 1;
        const weightedMultiplier = Math.min(genreWeight, 2); // Cap at 2x to prevent over-weighting
        
        if (rating >= 8.0) {
            score += 100 * weightedMultiplier; // Highest priority, weighted by frequency
        } else {
            score += 50 * weightedMultiplier; // Priority 2: Genre match (any score)
        }
    }
    
    // Priority 3: Same director with frequency weighting
    if (directorMatch) {
        matchCount++;
        const directorWeight = precomputedPrefs.directorFrequency?.[movie.director] || 1;
        score += 30 * Math.min(directorWeight, 1.5); // Weight by frequency, cap at 1.5x
    }
    
    // Priority 4: Same movie star/actor with frequency weighting
    if (actorMatch) {
        matchCount++;
        // Find which actor matched and get their frequency
        let matchedActor = null;
        const normalizedCast = new Set((movie.cast || []).map(a => normalizeString(a)));
        for (const actor of precomputedPrefs.actors) {
            if (normalizedCast.has(actor)) {
                // Find original actor name (not normalized)
                matchedActor = Array.from(movie.cast || []).find(a => normalizeString(a) === actor);
                break;
            }
        }
        
        const actorWeight = matchedActor ? (precomputedPrefs.actorFrequency?.[matchedActor] || 1) : 1;
        score += 20 * Math.min(actorWeight, 1.5); // Weight by frequency, cap at 1.5x
    }
    
    // ENHANCED: Multiple matches bonus (more accurate recommendations!)
    if (matchCount >= 2) {
        score += 25; // Bonus for 2+ matches
    }
    if (matchCount >= 3) {
        score += 50; // Bigger bonus for 3 matches (genre + director + actor)
    }
    
    // ENHANCED: Rating proximity bonus (movies closer to user's preferred rating)
    if (precomputedPrefs.userAvgRating) {
        const ratingDiff = Math.abs(rating - precomputedPrefs.userAvgRating);
        if (ratingDiff <= 0.5) {
            score += 15; // Very close to user's preference
        } else if (ratingDiff <= 1.0) {
            score += 10; // Close to user's preference
        }
    }
    
    // ENHANCED: Recency bonus (prefer movies from last 10 years)
    if (movie.year) {
        const currentYear = new Date().getFullYear();
        const movieYear = parseInt(movie.year);
        if (!isNaN(movieYear)) {
            const yearsAgo = currentYear - movieYear;
            if (yearsAgo <= 5) {
                score += 5; // Very recent (last 5 years)
            } else if (yearsAgo <= 10) {
                score += 3; // Recent (last 10 years)
            }
        }
    }
    
    return {
        score,
        rating,
        matchCount, // Track how many criteria matched
        breakdown: {
            genreHighScore: genreMatch && rating >= 8.0,
            genreMatch: genreMatch && rating < 8.0,
            directorMatch: directorMatch,
            actorMatch: actorMatch,
            multipleMatches: matchCount >= 2
        }
    };
}

/**
 * Verify algorithm correctness
 */
export function verifyAlgorithmCorrectness(recommendations, favorites = [], watchedMovies = [], allMovies = [], userRatings = {}) {
    if (recommendations.length === 0) {
        console.log('✓ Algorithm verification: No recommendations (expected if no favorites/watched)');
        return true;
    }
    
    const preferences = extractUserPreferences(favorites, watchedMovies, allMovies, userRatings);
    const precomputedPrefs = precomputePreferences(preferences);
    const topMovies = recommendations.slice(0, 5);
    
    console.log('=== Algorithm Verification ===');
    console.log(`Total recommendations: ${recommendations.length}`);
    console.log('Top 5 recommendations:');
    
    let hasGenreHighScore = false;
    let priorityOrder = true;
    let prevScore = Infinity;
    
    topMovies.forEach((movie, index) => {
        const scoring = calculateRecommendationScore(movie, precomputedPrefs);
        const breakdown = scoring.breakdown;
        
        console.log(`\n${index + 1}. ${movie.title}`);
        console.log(`   Score: ${scoring.score}, Rating: ${scoring.rating}`);
        console.log(`   Genre+High: ${breakdown.genreHighScore}, Genre: ${breakdown.genreMatch}, Director: ${breakdown.directorMatch}, Actor: ${breakdown.actorMatch}`);
        
        if (breakdown.genreHighScore) {
            hasGenreHighScore = true;
        }
        
        // Check if scores are in descending order
        if (scoring.score > prevScore) {
            priorityOrder = false;
        }
        prevScore = scoring.score;
    });
    
    // Verification checks
    const checks = {
        hasGenreHighScoreMovies: hasGenreHighScore,
        correctPriorityOrder: priorityOrder,
        topMovieHasScore: topMovies[0] && calculateRecommendationScore(topMovies[0], precomputedPrefs).score > 0
    };
    
    console.log('\n=== Verification Results ===');
    Object.keys(checks).forEach(check => {
        const passed = checks[check];
        console.log(`${passed ? '✓' : '✗'} ${check}: ${passed}`);
    });
    
    return Object.values(checks).every(v => v);
}

/**
 * Fetch API recommendations based on preferences
 * OPTIMIZED: All API calls now run in parallel instead of sequentially (3-5x faster)
 */
async function fetchAPIRecommendations(preferences, limit = 20) {
    const apiMovies = [];
    
    try {
        // PARALLELIZE all API calls using Promise.all (much faster!)
        const [genreResults, directorResults, actorResults] = await Promise.all([
            // Fetch movies by genres in parallel
            Promise.all(
                preferences.genres.slice(0, 3).map(genre => 
                    searchMoviesByGenre(genre, {
                        minRating: preferences.minRating
                    }).then(movies => movies.slice(0, 10))
                )
            ),
            // Fetch movies by directors in parallel
            Promise.all(
                preferences.directors.slice(0, 2).map(director => 
                    searchMoviesByDirector(director).then(movies => movies.slice(0, 5))
                )
            ),
            // Fetch movies by actors in parallel
            Promise.all(
                preferences.actors.slice(0, 2).map(actor => 
                    searchMoviesByActor(actor).then(movies => movies.slice(0, 5))
                )
            )
        ]);
        
        // Flatten all results
        apiMovies.push(
            ...genreResults.flat(),
            ...directorResults.flat(),
            ...actorResults.flat()
        );
    } catch (error) {
        console.error('Error fetching API recommendations:', error);
    }
    
    return apiMovies;
}

/**
 * Get recommended movies with scoring algorithm
 * ENHANCED: Now accepts userRatings for more accurate recommendations
 */
export async function getRecommendedMovies(localMovies, favorites, useAPI = false, limit = 20, watchedMovies = [], allMoviesForLookup = [], userRatings = {}) {
    // Need at least favorites or watchedMovies to generate recommendations
    if ((!favorites || favorites.length === 0) && (!watchedMovies || watchedMovies.length === 0)) {
        return [];
    }
    
    // Extract user preferences from both favorites and watched movies
    // ENHANCED: Now includes user ratings for better accuracy
    const preferences = extractUserPreferences(favorites || [], watchedMovies, allMoviesForLookup, userRatings);
    
    if (preferences.genres.length === 0 && preferences.directors.length === 0 && preferences.actors.length === 0) {
        return [];
    }
    
    // Pre-compute preferences once for O(1) lookups (much faster scoring)
    const precomputedPrefs = precomputePreferences(preferences);
    
    // Normalize local movies to API format
    const normalizedLocalMovies = localMovies.map(movie => {
        const normalized = normalizeLocalToAPI(movie);
        // Preserve original local data
        normalized.director = movie.director;
        normalized.cast = movie.cast || [];
        normalized.imdb = movie.imdb;
        normalized.genre = movie.genre;
        return normalized;
    });
    
    // Get API movies if enabled
    let allMovies = [...normalizedLocalMovies];
    if (useAPI) {
        try {
            const apiMovies = await fetchAPIRecommendations(preferences, limit);
            allMovies = mergeLocalAndAPIResults(normalizedLocalMovies, apiMovies);
        } catch (error) {
            console.error('API fetch failed, using local movies only:', error);
        }
    }
    
    // Get favorite IDs and titles to exclude
    const favoriteIds = new Set((favorites || []).map(fav => fav.id));
    const favoriteTitles = new Set((favorites || []).map(fav => fav.title.toLowerCase().trim()));
    
    // Get watched movie IDs and titles to exclude
    const watchedIds = new Set(watchedMovies.map(m => {
        // Handle both ID strings/numbers and movie objects
        if (typeof m === 'string' || typeof m === 'number') {
            return String(m);
        }
        return String(m.id || m.tmdbId);
    }));
    const watchedTitles = new Set(watchedMovies
        .filter(m => typeof m === 'object' && m.title)
        .map(m => m.title.toLowerCase().trim()));
    
    // Also check allMoviesForLookup for watched movie titles
    watchedMovies.forEach(id => {
        const movie = allMoviesForLookup.find(m => m.id === id || m.tmdbId === id);
        if (movie && movie.title) {
            watchedTitles.add(movie.title.toLowerCase().trim());
        }
    });
    
    // OPTIMIZED: Process movies in batches with early termination
    // Stop processing once we have enough high-scoring movies (2-3x faster for large datasets)
    const scoredMovies = [];
    const batchSize = 50;
    const targetCount = limit * 2; // Get 2x the limit to ensure we have enough good ones
    
    for (let i = 0; i < allMovies.length; i += batchSize) {
        const batch = allMovies.slice(i, i + batchSize);
        
        for (const movie of batch) {
            const movieId = String(movie.id || movie.tmdbId || '');
            const movieTmdbId = String(movie.tmdbId || '');
            // Extract numeric ID if movie.id is in format "tmdb_123"
            const numericId = movieId.startsWith('tmdb_') ? movieId.replace('tmdb_', '') : movieId;
            const movieTitle = (movie.title || '').toLowerCase().trim();
            
            // Skip if already in favorites
            const isFavorite = favoriteIds.has(movie.id) || 
                              favoriteTitles.has(movieTitle) ||
                              (movie.localData && favoriteIds.has(movie.localData.id));
            
            // Skip if already watched - check multiple ID formats
            const isWatched = watchedIds.has(movieId) ||
                             watchedIds.has(movieTmdbId) ||
                             watchedIds.has(numericId) ||
                             watchedTitles.has(movieTitle) ||
                             (movie.localData && watchedIds.has(String(movie.localData.id)));
            
            if (isFavorite || isWatched) continue;
            
            // Use precomputed preferences for faster scoring
            const scoring = calculateRecommendationScore(movie, precomputedPrefs);
            if (scoring.score > 0) {
                scoredMovies.push({
                    ...movie,
                    recommendationScore: scoring.score,
                    recommendationRating: scoring.rating,
                    scoreBreakdown: scoring.breakdown
                });
            }
        }
        
        // Early termination: if we have enough high-scoring movies, stop processing
        if (scoredMovies.length >= targetCount) {
            // Sort what we have and take top N
            scoredMovies.sort((a, b) => {
                if (b.recommendationScore !== a.recommendationScore) {
                    return b.recommendationScore - a.recommendationScore;
                }
                return b.recommendationRating - a.recommendationRating;
            });
            return scoredMovies.slice(0, limit);
        }
    }
    
    // Final sort if we didn't hit early termination
    scoredMovies.sort((a, b) => {
        // Sort by score (descending), then by rating (descending)
        if (b.recommendationScore !== a.recommendationScore) {
            return b.recommendationScore - a.recommendationScore;
        }
        return b.recommendationRating - a.recommendationRating;
    });
    
    // ENHANCED: Add diversity control to avoid too many movies from same director/actor
    const directorCount = new Map();
    const actorCount = new Map();
    const maxPerDirector = 3; // Max 3 movies per director
    const maxPerActor = 2; // Max 2 movies per actor
    
    const diverseMovies = scoredMovies.filter(movie => {
        // Check director diversity
        if (movie.director) {
            const dirCount = directorCount.get(movie.director) || 0;
            if (dirCount >= maxPerDirector) return false;
            directorCount.set(movie.director, dirCount + 1);
        }
        
        // Check actor diversity (if multiple actors match)
        if (movie.cast && Array.isArray(movie.cast) && movie.cast.length > 0) {
            // Check if any actor in the cast has reached the limit
            const hasReachedLimit = movie.cast.some(actor => {
                const actCount = actorCount.get(actor) || 0;
                return actCount >= maxPerActor;
            });
            
            if (hasReachedLimit) {
                return false; // Skip if any actor has reached limit
            }
            
            // Increment count for all actors in cast
            movie.cast.forEach(actor => {
                actorCount.set(actor, (actorCount.get(actor) || 0) + 1);
            });
        }
        
        return true;
    });
    
    // Verify algorithm correctness (in development mode)
    if (import.meta.env.DEV) {
        verifyAlgorithmCorrectness(diverseMovies, favorites || [], watchedMovies, allMoviesForLookup, userRatings);
    }
    
    // Return top N diverse movies
    return diverseMovies.slice(0, limit);
}

// Legacy support: keep old function signature for backward compatibility
// This allows calculateRecommendationScore to work with both old and new formats
export function calculateRecommendationScoreLegacy(movie, preferences) {
    // Convert old format to new format
    const precomputedPrefs = precomputePreferences(preferences);
    return calculateRecommendationScore(movie, precomputedPrefs);
}

