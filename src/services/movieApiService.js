import { getApiUrl, getImageUrl, GENRE_MAP, TMDB_ENDPOINTS, checkRateLimit } from '../config/api.js';

// Cache for API responses (simple in-memory cache)
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check cache and return cached data if available
 */
function getCached(key) {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    apiCache.delete(key);
    return null;
}

/**
 * Store data in cache
 */
function setCache(key, data) {
    apiCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

/**
 * Normalize local movie data to match API format
 */
export function normalizeLocalToAPI(localMovie) {
    return {
        id: `local_${localMovie.id}`,
        title: localMovie.title,
        original_title: localMovie.title,
        release_date: localMovie.year ? `${localMovie.year}-01-01` : null,
        year: localMovie.year,
        genre_ids: [GENRE_MAP[localMovie.genre] || 0].filter(id => id > 0),
        genre: localMovie.genre,
        overview: localMovie.summary || '',
        vote_average: parseFloat(localMovie.imdb) || 0,
        imdb: localMovie.imdb,
        poster_path: typeof localMovie.poster === 'string' ? localMovie.poster : null,
        poster: localMovie.poster,
        director: localMovie.director,
        cast: localMovie.cast || [],
        isLocal: true,
        localData: localMovie
    };
}

/**
 * Map TMDB genre ID to local genre name
 */
function mapTMDBGenreToLocal(genreId) {
    const genreMap = {
        878: "Bilim Kurgu",
        35: "Komedi",
        28: "Aksiyon/Macera",  // Action maps to merged category
        16: "Animasyon",
        80: "Suç",
        12: "Aksiyon/Macera",  // Adventure maps to merged category
        18: "Drama",
        9648: "Gizem",
        99: "Belgesel",
        27: "Korku",
        53: "Gizem",  // Thriller maps to Gizem
        10749: "Drama",  // Romance maps to Drama
        14: "Bilim Kurgu"  // Fantasy maps to Bilim Kurgu
    };
    return genreMap[genreId] || 'Bilinmeyen';
}

/**
 * Map English genre name to Turkish
 */
function mapEnglishGenreToTurkish(genreName) {
    const genreMap = {
        'Science Fiction': 'Bilim Kurgu',
        'Comedy': 'Komedi',
        'Action': 'Aksiyon/Macera',
        'Animation': 'Animasyon',
        'Crime': 'Suç',
        'Adventure': 'Aksiyon/Macera',
        'Drama': 'Drama',
        'Mystery': 'Gizem',
        'Documentary': 'Belgesel',
        'Biography': 'Belgesel', // Some movies may still have Biography tag
        'Horror': 'Korku',
        'Thriller': 'Gizem',  // Thriller maps to Gizem
        'Romance': 'Drama',  // Romance maps to Drama
        'Fantasy': 'Bilim Kurgu'  // Fantasy maps to Bilim Kurgu
    };
    return genreMap[genreName] || genreName;
}

/**
 * Get primary genre name from TMDB movie (for grid/scroll views)
 */
function getGenreFromTMDBMovie(tmdbMovie) {
    // If genres array exists (from full details), use first genre name
    if (tmdbMovie.genres && Array.isArray(tmdbMovie.genres) && tmdbMovie.genres.length > 0) {
        const genreName = tmdbMovie.genres[0].name;
        return mapEnglishGenreToTurkish(genreName);
    }
    
    // If genre_ids array exists (from search/discover), map first ID
    if (tmdbMovie.genre_ids && Array.isArray(tmdbMovie.genre_ids) && tmdbMovie.genre_ids.length > 0) {
        return mapTMDBGenreToLocal(tmdbMovie.genre_ids[0]);
    }
    
    return 'Bilinmeyen';
}

/**
 * Get all genres from TMDB movie (for detail page - up to 3 genres)
 */
function getAllGenresFromTMDBMovie(tmdbMovie) {
    const genres = [];
    
    // If genres array exists (from full details), use genre names
    if (tmdbMovie.genres && Array.isArray(tmdbMovie.genres) && tmdbMovie.genres.length > 0) {
        genres.push(...tmdbMovie.genres.map(g => mapEnglishGenreToTurkish(g.name)));
    }
    // If genre_ids array exists (from search/discover), map IDs to names
    else if (tmdbMovie.genre_ids && Array.isArray(tmdbMovie.genre_ids) && tmdbMovie.genre_ids.length > 0) {
        genres.push(...tmdbMovie.genre_ids.map(id => mapTMDBGenreToLocal(id)));
    }
    
    // Remove duplicates and return up to 3 genres
    const uniqueGenres = [...new Set(genres)].filter(g => g && g !== 'Bilinmeyen');
    return uniqueGenres.slice(0, 3); // Return max 3 genres
}

/**
 * Convert TMDB movie to our format
 */
function convertTMDBToMovieFormat(tmdbMovie, fullDetails = null) {
    const details = fullDetails || tmdbMovie;
    
    // Preserve genre_ids from TMDB for filtering
    const genreIds = details.genre_ids || 
                     (details.genres ? details.genres.map(g => g.id) : []) ||
                     tmdbMovie.genre_ids || 
                     [];
    
    return {
        id: `tmdb_${tmdbMovie.id}`,
        title: tmdbMovie.title || tmdbMovie.original_title,
        year: tmdbMovie.release_date ? tmdbMovie.release_date.split('-')[0] : null,
        release_date: tmdbMovie.release_date || details.release_date || null, // Preserve full release date for filtering
        genre: getGenreFromTMDBMovie(details), // Primary genre (for grid/scroll views)
        genres: getAllGenresFromTMDBMovie(details), // All genres array (for detail page - up to 3)
        genre_ids: genreIds, // Preserve genre_ids for filtering
        poster: getImageUrl(tmdbMovie.poster_path),
        summary: tmdbMovie.overview || details.overview || '',
        director: details.director || 
                  getDirectorFromCrew(details.crew) || 
                  getDirectorFromCrew(details.credits?.crew) ||
                  getDirectorFromCrew(tmdbMovie.crew) ||
                  getDirectorFromCrew(tmdbMovie.credits?.crew) ||
                  null,
        cast: (details.cast || details.credits?.cast || []).slice(0, 5).map(c => c.name || c) || [],
        imdb: details.vote_average ? details.vote_average.toFixed(1) : (tmdbMovie.vote_average?.toFixed(1) || '0.0'),
        tmdbId: tmdbMovie.id,
        isLocal: false,
        original_language: tmdbMovie.original_language || details.original_language // Preserve for filtering
    };
}

/**
 * Check if a movie has been released (release date is today or in the past)
 */
function isMovieReleased(movie) {
    // Check release_date from TMDB format
    if (movie.release_date) {
        const releaseDate = new Date(movie.release_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
        return releaseDate <= today;
    }
    
    // Check year if release_date is not available
    if (movie.year) {
        const releaseYear = parseInt(movie.year);
        const currentYear = new Date().getFullYear();
        if (!isNaN(releaseYear)) {
            // If year is in the future, it's not released
            if (releaseYear > currentYear) {
                return false;
            }
            // If year is current year, we can't be sure, so allow it (better to show than hide)
            // If year is in the past, it's definitely released
            return releaseYear <= currentYear;
        }
    }
    
    // If no date info, assume it's released (better to show than hide)
    return true;
}

/**
 * Extract director from crew array
 */
function getDirectorFromCrew(crew) {
    if (!crew) return null;
    // Handle both direct crew array and credits.crew structure
    const crewArray = Array.isArray(crew) ? crew : (crew.crew || []);
    if (!Array.isArray(crewArray)) return null;
    // Find director - check both 'Director' job and 'director' (case-insensitive)
    const director = crewArray.find(person => 
        person.job === 'Director' || 
        person.job === 'director' ||
        (person.job && person.job.toLowerCase() === 'director')
    );
    return director ? (director.name || director.original_name) : null;
}

/**
 * Check if a movie has incompatible genre combinations
 * Returns true if movie should be excluded
 */
function hasIncompatibleGenres(movie, selectedGenreId) {
    if (!movie.genre_ids || !Array.isArray(movie.genre_ids) || movie.genre_ids.length <= 1) {
        return false; // Single genre or no genres, no conflict
    }
    
    const genreIds = movie.genre_ids;
    
    // Check if movie has the selected genre
    const hasSelectedGenre = genreIds.includes(selectedGenreId);
    
    if (!hasSelectedGenre) {
        return false; // Movie doesn't have selected genre, won't appear anyway
    }
    
    // For Animation (16), filter out movies that also have Drama, Horror, or other incompatible genres
    if (selectedGenreId === 16) { // Animation
        const incompatibleWithAnimation = [
            18,    // Drama
            27,    // Horror
            80,    // Crime
            99,    // Documentary
            9648   // Mystery
        ];
        // If movie has Animation + any incompatible genre, filter it out
        if (incompatibleWithAnimation.some(genreId => genreIds.includes(genreId))) {
            return true;
        }
    }
    
    // For Horror (27), filter out incompatible combinations
    if (selectedGenreId === 27) { // Horror
        const incompatibleWithHorror = [
            16,    // Animation
            10751, // Family
            35,    // Comedy
            10402  // Musical
        ];
        if (incompatibleWithHorror.some(genreId => genreIds.includes(genreId))) {
            return true;
        }
    }
    
    // For Drama (18), filter out Animation combinations
    if (selectedGenreId === 18) { // Drama
        if (genreIds.includes(16)) { // Animation
            return true;
        }
    }
    
    // Define other incompatible genre pairs
    const incompatiblePairs = [
        [16, 99]    // Animation + Documentary
    ];
    
    // Check if movie has any incompatible genre combination
    for (const [genre1, genre2] of incompatiblePairs) {
        // If the selected genre is one of the incompatible genres, check for the other
        if (selectedGenreId === genre1 && genreIds.includes(genre2)) {
            return true; // Found incompatible combination
        }
        if (selectedGenreId === genre2 && genreIds.includes(genre1)) {
            return true; // Found incompatible combination
        }
    }
    
    return false;
}

/**
 * Search movies by genre
 */
export async function searchMoviesByGenre(genre, options = {}) {
    const { minYear, maxYear, minRating, page = 1, limit = 20, sortBy = null } = options;
    
    const genreIds = GENRE_MAP[genre];
    if (!genreIds) {
        console.warn(`Genre "${genre}" not mapped to TMDB`);
        return [];
    }
    
    // Handle merged category (Action/Adventure) which has array of genre IDs
    const isMergedCategory = Array.isArray(genreIds);
    const genreIdArray = isMergedCategory ? genreIds : [genreIds];
    const primaryGenreId = isMergedCategory ? genreIds[0] : genreIds;
    
    // Map sortBy to TMDB sort parameters
    // null/default = new movies sorted by rating (recent releases, sorted by rating)
    // most_liked = popularity
    // most_rated = vote_average (highest ratings)
    // For filters, after page 5, ensure we still have content by keeping the same sort
    const sortByMap = {
        'most_liked': 'popularity.desc',
        'most_rated': 'vote_average.desc',
        null: 'release_date.desc', // Default: fetch new movies, then sort by rating
        'new_most_rated': 'release_date.desc'
    };
    const tmdbSortBy = sortByMap[sortBy] || sortByMap[null];
    
    const cacheKey = `genre_${isMergedCategory ? genreIds.join('_') : genreIds}_${sortBy || 'new_rated'}_${minYear}_${maxYear}_${minRating}_${page}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
        await checkRateLimit();
        
        // For merged categories, we'll fetch movies with the first genre and then filter
        // For single genres, use the genre ID directly
        const params = {
            with_genres: primaryGenreId,
            page,
            sort_by: tmdbSortBy, // Use the mapped sort parameter
            'vote_count.gte': 100, // Only show movies with at least 100 votes (ensures quality)
            language: 'en-US',
            with_original_language: 'en' // Filter out non-English (including Turkish) movies
        };
        
        // For null/default (new movies): show recent movies with high ratings (7.0+)
        // For most_rated: use standard minimum rating (6.0)
        // For other sorts: use standard minimum rating (6.0)
        if (sortBy === null || sortBy === 'new_most_rated') {
            params['vote_average.gte'] = 7.0; // Higher threshold for recent high-rated movies
        } else {
            params['vote_average.gte'] = minRating || 6.0; // Standard minimum rating
        }
        
        if (minYear) params['primary_release_date.gte'] = `${minYear}-01-01`;
        if (maxYear) params['primary_release_date.lte'] = `${maxYear}-12-31`;
        
        const url = getApiUrl(TMDB_ENDPOINTS.DISCOVER_MOVIE, params);
        if (!url) return [];
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        let results = data.results || [];
        
        // For merged category, also fetch from the second genre and merge results
        if (isMergedCategory && genreIds.length > 1) {
            await checkRateLimit();
            const params2 = {
                ...params,
                with_genres: genreIds[1],
                page,
                sort_by: tmdbSortBy // Use the same sorting for merged category
            };
            const url2 = getApiUrl(TMDB_ENDPOINTS.DISCOVER_MOVIE, params2);
            if (url2) {
                try {
                    const response2 = await fetch(url2);
                    if (response2.ok) {
                        const data2 = await response2.json();
                        // Merge results, removing duplicates by ID
                        const existingIds = new Set(results.map(m => m.id));
                        const newResults = (data2.results || []).filter(m => !existingIds.has(m.id));
                        results = [...results, ...newResults];
                        // Sort based on the sortBy option
                        if (sortBy === 'most_liked') {
                            results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                        } else if (sortBy === 'most_rated') {
                            results.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
                        } else if (sortBy === null || sortBy === 'new_most_rated') {
                            // Default/new movies: sort by rating (highest to lowest)
                            results.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
                        } else {
                            // Default: sort by vote average (most rated)
                            results.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
                        }
                    }
                } catch (e) {
                    console.warn('Error fetching second genre for merged category:', e);
                }
            }
        }
        
        // OPTIMIZED: Use basic movie data from discover endpoint (10-20x faster!)
        // Full details (director, cast) will be fetched only when user clicks on a movie
        // This reduces loading time from 6+ seconds to under 1 second
        const fetchLimit = Math.min(limit || 50, results.length);
        const basicMovies = results.slice(0, fetchLimit).map(movie => convertTMDBToMovieFormat(movie));
        
        // Filter movies to only include those where the selected genre is the PRIMARY (first) genre
        // Also filter out Turkish movies, Spanish movies, Musical/Music genre movies, unreleased movies, and specific blocked titles
        const blockedTitles = ['nude', 'succubus', 'the way to the hearth'];
        const validMovies = basicMovies
            .filter(m => m !== null)
            .filter(movie => {
                // Must have genre_ids array
                if (!movie.genre_ids || !Array.isArray(movie.genre_ids) || movie.genre_ids.length === 0) {
                    return false;
                }
                
                // Filter out unreleased movies
                if (!isMovieReleased(movie)) {
                    return false;
                }
                
                // Filter out blocked titles (case-insensitive)
                const movieTitle = (movie.title || '').toLowerCase();
                if (blockedTitles.some(blocked => movieTitle.includes(blocked.toLowerCase()))) {
                    return false;
                }
                
                // Filter out Turkish movies - only show English movies
                const originalLanguage = movie.original_language || '';
                if (originalLanguage.toLowerCase() === 'tr') {
                    return false;
                }
                
                // Filter out Spanish movies
                if (originalLanguage.toLowerCase() === 'es') {
                    return false;
                }
                
                // Filter out Musical/Music genre movies (TMDB genre ID 10402)
                if (movie.genre_ids.includes(10402)) {
                    return false;
                }
                
                // Filter out Family movies (TMDB genre ID 10751) from all genres EXCEPT Comedy
                // Family movies should only appear in Comedy genre
                const isComedyGenre = genreIdArray.includes(35); // 35 is Comedy genre ID
                if (!isComedyGenre && movie.genre_ids.includes(10751)) {
                    return false;
                }
                
                // FILTERING: The selected genre (or any of the merged genres) must be present in the movie's genres
                // For most genres, check if the genre is in the array (not just primary)
                // This ensures movies with the selected genre are shown even if it's not the primary genre
                if (!movie.genre_ids || movie.genre_ids.length === 0) {
                    return false;
                }
                // Check if any of the selected genre IDs are in the movie's genre_ids array
                const matchesGenre = genreIdArray.some(genreId => movie.genre_ids.includes(genreId));
                return matchesGenre;
            });
        
        // Sort the final results based on sortBy
        if (sortBy === 'most_liked') {
            validMovies.sort((a, b) => {
                const ratingA = parseFloat(a.imdb) || 0;
                const ratingB = parseFloat(b.imdb) || 0;
                // Use popularity if available, otherwise use rating
                return ratingB - ratingA;
            });
        } else if (sortBy === 'most_rated') {
            validMovies.sort((a, b) => {
                const ratingA = parseFloat(a.imdb) || 0;
                const ratingB = parseFloat(b.imdb) || 0;
                return ratingB - ratingA;
            });
        } else if (sortBy === null || sortBy === 'new_most_rated') {
            // Default/new movies: sort by rating (highest to lowest)
            validMovies.sort((a, b) => {
                const ratingA = parseFloat(a.imdb) || 0;
                const ratingB = parseFloat(b.imdb) || 0;
                return ratingB - ratingA;
            });
        }
        
        setCache(cacheKey, validMovies);
        return validMovies;
    } catch (error) {
        console.error('Error searching movies by genre:', error);
        return [];
    }
}

/**
 * Search movies by director
 */
export async function searchMoviesByDirector(directorName) {
    if (!directorName) return [];
    
    const cacheKey = `director_${directorName.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
        await checkRateLimit();
        
        // First, search for the person
        const searchUrl = getApiUrl(TMDB_ENDPOINTS.SEARCH_PERSON, {
            query: directorName,
            page: 1
        });
        
        if (!searchUrl) return [];
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error('Person search failed');
        
        const searchData = await searchResponse.json();
        const person = searchData.results?.[0];
        
        if (!person) return [];
        
        // Get movies for this person (as director)
        await checkRateLimit();
        
        const personUrl = getApiUrl(`${TMDB_ENDPOINTS.PERSON_MOVIES}/${person.id}/movie_credits`);
        if (!personUrl) return [];
        
        const personResponse = await fetch(personUrl);
        if (!personResponse.ok) throw new Error('Person movies failed');
        
        const personData = await personResponse.json();
        
        // Filter for director role and get full details
        const directorMovies = (personData.crew || [])
            .filter(credit => credit.job === 'Director')
            .slice(0, 20); // Limit to 20 movies
        
        const moviesWithDetails = await Promise.all(
            directorMovies.slice(0, 10).map(async (credit) => {
                await checkRateLimit();
                const detailsUrl = getApiUrl(`${TMDB_ENDPOINTS.MOVIE_DETAILS}/${credit.id}`, {
                    append_to_response: 'credits'
                });
                if (!detailsUrl) return null;
                
                try {
                    const detailsResponse = await fetch(detailsUrl);
                    if (!detailsResponse.ok) return null;
                    const details = await detailsResponse.json();
                    return convertTMDBToMovieFormat(details, details);
                } catch (e) {
                    return null;
                }
            })
        );
        
        // Filter out Turkish movies, Spanish movies, Musical genre movies, unreleased movies, and specific blocked titles
        const blockedTitles = ['nude', 'succubus', 'the way to the hearth'];
        const movies = moviesWithDetails
            .filter(m => m !== null)
            .filter(movie => {
                // Filter out unreleased movies
                if (!isMovieReleased(movie)) {
                    return false;
                }
                
                // Filter out blocked titles (case-insensitive)
                const movieTitle = (movie.title || '').toLowerCase();
                if (blockedTitles.some(blocked => movieTitle.includes(blocked.toLowerCase()))) {
                    return false;
                }
                
                const originalLanguage = movie.original_language || '';
                // Filter out Turkish and Spanish movies
                if (originalLanguage.toLowerCase() === 'tr' || originalLanguage.toLowerCase() === 'es') {
                    return false;
                }
                // Filter out Musical/Music genre movies (TMDB genre ID 10402)
                if (movie.genre_ids && movie.genre_ids.includes(10402)) {
                    return false;
                }
                return true;
            });
        setCache(cacheKey, movies);
        return movies;
    } catch (error) {
        console.error('Error searching movies by director:', error);
        return [];
    }
}

/**
 * Search movies by actor
 */
export async function searchMoviesByActor(actorName) {
    if (!actorName) return [];
    
    const cacheKey = `actor_${actorName.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
        await checkRateLimit();
        
        // First, search for the person
        const searchUrl = getApiUrl(TMDB_ENDPOINTS.SEARCH_PERSON, {
            query: actorName,
            page: 1
        });
        
        if (!searchUrl) return [];
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error('Person search failed');
        
        const searchData = await searchResponse.json();
        const person = searchData.results?.[0];
        
        if (!person) return [];
        
        // Get movies for this person (as actor)
        await checkRateLimit();
        
        const personUrl = getApiUrl(`${TMDB_ENDPOINTS.PERSON_MOVIES}/${person.id}/movie_credits`);
        if (!personUrl) return [];
        
        const personResponse = await fetch(personUrl);
        if (!personResponse.ok) throw new Error('Person movies failed');
        
        const personData = await personResponse.json();
        
        // Get cast movies (top 20 by popularity)
        const actorMovies = (personData.cast || [])
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
            .slice(0, 20);
        
        const moviesWithDetails = await Promise.all(
            actorMovies.slice(0, 10).map(async (credit) => {
                await checkRateLimit();
                const detailsUrl = getApiUrl(`${TMDB_ENDPOINTS.MOVIE_DETAILS}/${credit.id}`, {
                    append_to_response: 'credits'
                });
                if (!detailsUrl) return null;
                
                try {
                    const detailsResponse = await fetch(detailsUrl);
                    if (!detailsResponse.ok) return null;
                    const details = await detailsResponse.json();
                    return convertTMDBToMovieFormat(details, details);
                } catch (e) {
                    return null;
                }
            })
        );
        
        // Filter out Turkish movies, Spanish movies, Musical genre movies, unreleased movies, and specific blocked titles
        const blockedTitles = ['nude', 'succubus', 'the way to the hearth'];
        const movies = moviesWithDetails
            .filter(m => m !== null)
            .filter(movie => {
                // Filter out unreleased movies
                if (!isMovieReleased(movie)) {
                    return false;
                }
                
                // Filter out blocked titles (case-insensitive)
                const movieTitle = (movie.title || '').toLowerCase();
                if (blockedTitles.some(blocked => movieTitle.includes(blocked.toLowerCase()))) {
                    return false;
                }
                
                const originalLanguage = movie.original_language || '';
                // Filter out Turkish and Spanish movies
                if (originalLanguage.toLowerCase() === 'tr' || originalLanguage.toLowerCase() === 'es') {
                    return false;
                }
                // Filter out Musical/Music genre movies (TMDB genre ID 10402)
                if (movie.genre_ids && movie.genre_ids.includes(10402)) {
                    return false;
                }
                return true;
            });
        setCache(cacheKey, movies);
        return movies;
    } catch (error) {
        console.error('Error searching movies by actor:', error);
        return [];
    }
}

/**
 * Get full movie details
 */
export async function getMovieDetails(movieId) {
    if (!movieId) {
        return null;
    }
    
    // Extract numeric ID if movieId is in format "tmdb_123"
    let numericId = movieId;
    if (typeof movieId === 'string' && movieId.startsWith('tmdb_')) {
        numericId = movieId.replace('tmdb_', '');
    }
    if (typeof movieId === 'string' && movieId.startsWith('local_')) {
        return null;
    }
    
    const cacheKey = `details_${numericId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
        await checkRateLimit();
        
        const url = getApiUrl(`${TMDB_ENDPOINTS.MOVIE_DETAILS}/${numericId}`, {
            append_to_response: 'credits'
        });
        
        if (!url) return null;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Movie details failed');
        
        const data = await response.json();
        const movie = convertTMDBToMovieFormat(data, data);
        
        setCache(cacheKey, movie);
        return movie;
    } catch (error) {
        console.error('Error getting movie details:', error);
        return null;
    }
}

/**
 * Merge local and API results, removing duplicates
 */
export function mergeLocalAndAPIResults(localMovies, apiMovies) {
    const movieMap = new Map();
    
    // Add local movies first
    localMovies.forEach(movie => {
        const key = movie.title.toLowerCase().trim();
        if (!movieMap.has(key)) {
            movieMap.set(key, movie);
        }
    });
    
    // Add API movies, skipping duplicates
    apiMovies.forEach(movie => {
        const key = movie.title.toLowerCase().trim();
        if (!movieMap.has(key)) {
            movieMap.set(key, movie);
        }
    });
    
    return Array.from(movieMap.values());
}


/**
 * Get top rated movies from TMDB
 */
export async function getTopRatedMovies(page = 1, limit = 50, sortBy = null) {
    // Map sortBy to TMDB sort parameters
    // null/default = release_date.desc (new movies, then sorted by rating)
    // most_rated = vote_average (highest ratings)
    // most_liked = popularity
    const sortByMap = {
        'most_rated': 'vote_average.desc',
        'most_liked': 'popularity.desc',
        null: 'release_date.desc', // Default: fetch new movies, then sort by rating
        'new_most_rated': 'release_date.desc'
    };
    
    // For null/default: first 2 pages show new movies, then switch to all highly rated movies
    let tmdbSortBy;
    let adjustedPage = page;
    let useOldMovies = false;
    
    if ((sortBy === null || sortBy === 'new_most_rated') && page > 2) {
        // After page 2, switch to all highly rated movies (older but highly rated)
        tmdbSortBy = 'vote_average.desc';
        adjustedPage = page - 2; // Start from page 1 of highly rated movies
        useOldMovies = true;
    } else {
        tmdbSortBy = sortByMap[sortBy] || sortByMap[null];
    }
    
    const cacheKey = `toprated_${sortBy || 'new_rated'}_${page}_${limit}_${useOldMovies ? 'old' : 'new'}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
        await checkRateLimit();
        
        // Use discover endpoint with sorting instead of fixed top_rated endpoint
        const params = {
            page: adjustedPage,
            sort_by: tmdbSortBy,
            'vote_count.gte': 100, // Only show movies with at least 100 votes (ensures quality)
            language: 'en-US',
            with_original_language: 'en' // Filter out non-English (including Turkish) movies
        };
        
        // For null/default: show recent movies with high ratings (7.0+) for first few pages
        // After page 2, switch to all highly rated movies (older but highly rated) to keep infinite scroll working
        if (sortBy === null || sortBy === 'new_most_rated') {
            if (page <= 2) {
                // First 2 pages: new movies with high ratings
                params['vote_average.gte'] = 7.0;
            } else {
                // After page 2: switch to all highly rated movies (older but highly rated)
                params['vote_average.gte'] = 7.0; // Keep same threshold for consistency
            }
        } else {
            params['vote_average.gte'] = 6.0; // Standard minimum rating
        }
        
        const url = getApiUrl(TMDB_ENDPOINTS.DISCOVER_MOVIE, params);
        if (!url) return [];
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        const results = data.results || [];
        const totalPages = data.total_pages || 0;
        const totalResults = data.total_results || 0;
        
        // OPTIMIZED: Use basic movie data from discover endpoint (10-20x faster!)
        // Full details (director, cast) will be fetched only when user clicks on a movie
        // This reduces loading time from 6+ seconds to under 1 second
        const fetchLimit = Math.min(limit, results.length);
        const basicMovies = results.slice(0, fetchLimit).map(movie => convertTMDBToMovieFormat(movie));
        
        // Filter out Turkish movies, Spanish movies, Musical genre movies, unreleased movies, and specific blocked titles
        const blockedTitles = ['nude', 'succubus', 'the way to the hearth'];
        const movies = basicMovies
            .filter(m => m !== null)
            .filter(movie => {
                // Filter out unreleased movies
                if (!isMovieReleased(movie)) {
                    return false;
                }
                
                // Filter out blocked titles (case-insensitive)
                const movieTitle = (movie.title || '').toLowerCase();
                if (blockedTitles.some(blocked => movieTitle.includes(blocked.toLowerCase()))) {
                    return false;
                }
                
                const originalLanguage = movie.original_language || '';
                // Filter out Turkish and Spanish movies
                if (originalLanguage.toLowerCase() === 'tr' || originalLanguage.toLowerCase() === 'es') {
                    return false;
                }
                // Filter out Musical/Music genre movies (TMDB genre ID 10402)
                if (movie.genre_ids && movie.genre_ids.includes(10402)) {
                    return false;
                }
                // Filter out Family movies (TMDB genre ID 10751) - Family movies should only appear in Comedy genre
                if (movie.genre_ids && movie.genre_ids.includes(10751)) {
                    return false;
                }
                return true;
            });
        
        // Sort based on sortBy option
        // For default behavior (null), always sort by rating (highest to lowest)
        // This ensures new movies and older highly-rated movies are both sorted by rating
        if (sortBy === 'most_liked') {
            movies.sort((a, b) => {
                const ratingA = parseFloat(a.imdb) || 0;
                const ratingB = parseFloat(b.imdb) || 0;
                return ratingB - ratingA;
            });
        } else if (sortBy === 'most_rated' || (sortBy === null && page > 2)) {
            // Most rated or default after page 2: sort by rating (highest to lowest)
            movies.sort((a, b) => {
                const ratingA = parseFloat(a.imdb) || 0;
                const ratingB = parseFloat(b.imdb) || 0;
                return ratingB - ratingA;
            });
        } else if (sortBy === null || sortBy === 'new_most_rated') {
            // Default/new movies (first 3 pages): sort by rating (highest to lowest)
            movies.sort((a, b) => {
                const ratingA = parseFloat(a.imdb) || 0;
                const ratingB = parseFloat(b.imdb) || 0;
                return ratingB - ratingA;
            });
        }
        
        setCache(cacheKey, movies);
        return movies;
    } catch (error) {
        console.error('Error fetching top rated movies:', error);
        return [];
    }
}

/**
 * Search movies in TMDB database
 */
export async function searchMoviesInTMDB(query, page = 1, limit = 20) {
    if (!query || query.trim().length === 0) return [];
    
    const cacheKey = `search_${query.toLowerCase()}_${page}`;
    const cached = getCached(cacheKey);
    if (cached) return cached.slice(0, limit);
    
    try {
        await checkRateLimit();
        
        const url = getApiUrl(TMDB_ENDPOINTS.SEARCH_MOVIE, {
            query: query.trim(),
            page,
            language: 'en-US'
        });
        
        if (!url) return [];
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        
        // OPTIMIZATION: Use search results directly without fetching full details
        // Full details will be fetched only when user clicks on a movie (in getMovieDetails)
        // This makes search 10-20x faster by avoiding N additional API calls
        const blockedTitles = ['nude', 'succubus', 'the way to the hearth'];
        const movies = (data.results || [])
            .slice(0, limit * 2) // Fetch more to account for filtering
            .map(movie => convertTMDBToMovieFormat(movie))
            .filter(movie => {
                if (!movie) return false;
                
                // Filter out unreleased movies
                if (!isMovieReleased(movie)) {
                    return false;
                }
                
                // Filter out blocked titles (case-insensitive)
                const movieTitle = (movie.title || '').toLowerCase();
                if (blockedTitles.some(blocked => movieTitle.includes(blocked.toLowerCase()))) {
                    return false;
                }
                
                const originalLanguage = movie.original_language || '';
                // Filter out Turkish and Spanish movies
                if (originalLanguage.toLowerCase() === 'tr' || originalLanguage.toLowerCase() === 'es') {
                    return false;
                }
                // Filter out Musical/Music genre movies (TMDB genre ID 10402)
                if (movie.genre_ids && movie.genre_ids.includes(10402)) {
                    return false;
                }
                // Filter out Family movies (TMDB genre ID 10751) - Family movies should only appear in Comedy genre
                if (movie.genre_ids && movie.genre_ids.includes(10751)) {
                    return false;
                }
                return true;
            })
            .slice(0, limit); // Return only the requested limit
        
        setCache(cacheKey, movies);
        return movies;
    } catch (error) {
        console.error('Error searching movies in TMDB:', error);
        return [];
    }
}

/**
 * Get watch providers for a movie
 * Only includes: Netflix, Amazon Prime, HBO Max, Apple TV (buy/rent only, not subscription)
 */
export async function getWatchProviders(movieId) {
    if (!movieId) {
        return null;
    }
    
    // Extract numeric ID if movieId is in format "tmdb_123"
    let numericId = movieId;
    if (typeof movieId === 'string' && movieId.startsWith('tmdb_')) {
        numericId = movieId.replace('tmdb_', '');
    }
    if (typeof movieId === 'string' && movieId.startsWith('local_')) {
        return null;
    }
    
    const cacheKey = `watch_providers_${numericId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
        await checkRateLimit();
        
        // Replace {id} placeholder in endpoint
        const endpoint = TMDB_ENDPOINTS.WATCH_PROVIDERS.replace('{id}', numericId);
        const url = getApiUrl(endpoint);
        
        if (!url) return null;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Watch providers fetch failed');
        
        const data = await response.json();
        
        // Prefer Turkey (TR) region, fallback to first available region
        const regions = data.results || {};
        const trRegion = regions.TR || regions.tr || null;
        const firstRegion = Object.values(regions)[0] || null;
        const selectedRegion = trRegion || firstRegion;
        
        if (!selectedRegion) {
            return null;
        }
        
        // Allowed providers for rent/buy (case-insensitive matching)
        const allowedProviders = [
            'netflix',
            'amazon prime', 'prime video', 'prime',
            'hbo max', 'hbo',
            'apple tv', 'itunes',
            'disney', 'disney+', 'disney plus'
        ];
        
        // Allowed providers for subscription services (Netflix, Amazon Prime, HBO, Disney+)
        const allowedSubscriptionProviders = [
            'netflix',
            'amazon prime', 'prime video', 'prime',
            'hbo max', 'hbo',
            'disney', 'disney+', 'disney plus'
        ];
        
        // Filter function to check if provider is allowed for rent/buy
        const isAllowedProvider = (providerName) => {
            const nameLower = (providerName || '').toLowerCase();
            return allowedProviders.some(allowed => nameLower.includes(allowed));
        };
        
        // Filter function to check if provider is allowed for subscription
        const isAllowedSubscriptionProvider = (providerName) => {
            const nameLower = (providerName || '').toLowerCase();
            return allowedSubscriptionProviders.some(allowed => nameLower.includes(allowed));
        };
        
        // Filter providers for rent/buy
        const filterProviders = (providerList) => {
            if (!Array.isArray(providerList)) return [];
            return providerList.filter(provider => 
                provider && provider.provider_name && isAllowedProvider(provider.provider_name)
            );
        };
        
        // Filter providers for subscription (exclude Apple TV)
        const filterSubscriptionProviders = (providerList) => {
            if (!Array.isArray(providerList)) return [];
            return providerList.filter(provider => {
                if (!provider || !provider.provider_name) return false;
                const nameLower = provider.provider_name.toLowerCase();
                // Exclude Apple TV from subscriptions
                if (nameLower.includes('apple tv') || nameLower.includes('itunes')) {
                    return false;
                }
                return isAllowedSubscriptionProvider(provider.provider_name);
            });
        };
        
        const providers = {
            rent: filterProviders(selectedRegion.rent || []),
            buy: filterProviders(selectedRegion.buy || []),
            flatrate: filterSubscriptionProviders(selectedRegion.flatrate || [])
        };
        
        // Only return if there are any providers
        if (providers.rent.length === 0 && providers.buy.length === 0 && providers.flatrate.length === 0) {
            return null;
        }
        
        setCache(cacheKey, providers);
        return providers;
    } catch (error) {
        console.error('Error getting watch providers:', error);
        return null;
    }
}

/**
 * Get top movies for onboarding (50 movies: 5 per genre from top movies)
 */
export async function getTopMoviesForOnboarding() {
    const cacheKey = 'onboarding_movies';
    const cached = getCached(cacheKey);
    if (cached) return cached;
    
    try {
        // Fetch fewer pages (3 pages = 60 movies, enough to get 5 per genre)
        const allMovies = [];
        const pagesToFetch = 3;
        
        for (let page = 1; page <= pagesToFetch; page++) {
            await checkRateLimit();
            
            const params = {
                page: page,
                sort_by: 'vote_average.desc',
                'vote_count.gte': 100,
                'vote_average.gte': 7.0,
                language: 'en-US',
                with_original_language: 'en'
            };
            
            const url = getApiUrl(TMDB_ENDPOINTS.DISCOVER_MOVIE, params);
            if (!url) continue;
            
            const response = await fetch(url);
            if (!response.ok) continue;
            
            const data = await response.json();
            const results = data.results || [];
            
            // Use basic movie data without fetching full details (much faster)
            // The genre info is already in genre_ids from the discover endpoint
            const movies = results.map(movie => convertTMDBToMovieFormat(movie));
            
            allMovies.push(...movies.filter(m => m !== null));
        }
        
        // Filter out Turkish, Spanish, Musical, unreleased movies, and blocked titles
        const blockedTitles = ['nude', 'succubus', 'the way to the hearth'];
        const validMovies = allMovies.filter(movie => {
            if (!movie) return false;
            
            // Filter out unreleased movies
            if (!isMovieReleased(movie)) {
                return false;
            }
            
            const movieTitle = (movie.title || '').toLowerCase();
            if (blockedTitles.some(blocked => movieTitle.includes(blocked.toLowerCase()))) {
                return false;
            }
            
            const originalLanguage = movie.original_language || '';
            if (originalLanguage.toLowerCase() === 'tr' || originalLanguage.toLowerCase() === 'es') {
                return false;
            }
            
            if (movie.genre_ids && movie.genre_ids.includes(10402)) { // Musical
                return false;
            }
            
            return true;
        });
        
        // Group movies by genre
        const genreGroups = {};
        const genreList = ["Bilim Kurgu", "Komedi", "Aksiyon/Macera", "Animasyon", "Suç", "Drama", "Gizem", "Belgesel", "Korku"];
        
        genreList.forEach(genre => {
            genreGroups[genre] = [];
        });
        
        validMovies.forEach(movie => {
            const movieGenre = movie.genre;
            if (movieGenre && genreGroups[movieGenre]) {
                genreGroups[movieGenre].push(movie);
            }
        });
        
        // Select 5 movies from each genre
        const selectedMovies = [];
        genreList.forEach(genre => {
            const genreMovies = genreGroups[genre] || [];
            // Shuffle and take first 5
            const shuffled = genreMovies.sort(() => Math.random() - 0.5);
            selectedMovies.push(...shuffled.slice(0, 5));
        });
        
        // If we don't have enough movies, fill with top-rated movies from any genre
        if (selectedMovies.length < 50) {
            const remaining = 50 - selectedMovies.length;
            const selectedIds = new Set(selectedMovies.map(m => m.id));
            const additionalMovies = validMovies
                .filter(m => !selectedIds.has(m.id))
                .sort((a, b) => parseFloat(b.imdb || 0) - parseFloat(a.imdb || 0))
                .slice(0, remaining);
            selectedMovies.push(...additionalMovies);
        }
        
        // Shuffle final selection for variety
        const finalMovies = selectedMovies.sort(() => Math.random() - 0.5).slice(0, 50);
        
        setCache(cacheKey, finalMovies);
        return finalMovies;
    } catch (error) {
        console.error('Error fetching onboarding movies:', error);
        return [];
    }
}

