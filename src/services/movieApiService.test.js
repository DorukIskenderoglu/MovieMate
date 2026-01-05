import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    searchMoviesByGenre,
    searchMoviesByDirector,
    searchMoviesByActor,
    getMovieDetails,
    getTopRatedMovies,
    searchMoviesInTMDB,
    getTopMoviesForOnboarding
} from './movieApiService.js';
import * as apiConfig from '../config/api.js';

// Mock fetch globally
global.fetch = vi.fn();

// Mock API config
vi.mock('../config/api.js', () => ({
    getApiUrl: vi.fn((endpoint, params) => {
        const baseUrl = 'https://api.themoviedb.org/3';
        const apiKey = 'test_key';
        const queryString = new URLSearchParams({ ...params, api_key: apiKey }).toString();
        return `${baseUrl}${endpoint}?${queryString}`;
    }),
    getImageUrl: vi.fn((path) => path ? `https://image.tmdb.org/t/p/w500${path}` : null),
    GENRE_MAP: {
        'Drama': 18,
        'Comedy': 35,
        'Action': 28,
        'Aksiyon/Macera': [28, 12]
    },
    TMDB_ENDPOINTS: {
        DISCOVER_MOVIE: '/discover/movie',
        SEARCH_MOVIE: '/search/movie',
        MOVIE_DETAILS: '/movie',
        SEARCH_PERSON: '/search/person',
        PERSON_MOVIES: '/person',
        WATCH_PROVIDERS: '/movie/{id}/watch/providers'
    },
    checkRateLimit: vi.fn(() => Promise.resolve())
}));

describe('MovieApiService - API Calls', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetch.mockClear();
    });

    afterEach(() => {
        // Clear cache between tests
        vi.clearAllTimers();
    });

    describe('searchMoviesByGenre', () => {
        it('should make correct API call with proper parameters', async () => {
            const mockResponse = {
                results: [
                    {
                        id: 1,
                        title: 'Test Movie',
                        release_date: '2020-01-01',
                        genre_ids: [18],
                        vote_average: 8.0,
                        overview: 'Test overview',
                        poster_path: '/poster.jpg',
                        original_language: 'en'
                    }
                ]
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            await searchMoviesByGenre('Drama', { minRating: 7.0 });

            expect(fetch).toHaveBeenCalledTimes(1);
            const callUrl = fetch.mock.calls[0][0];
            expect(callUrl).toContain('/discover/movie');
            expect(callUrl).toContain('with_genres=18');
            expect(callUrl).toContain('vote_average.gte=7.0');
        });

        it('should handle API errors gracefully', async () => {
            fetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            const result = await searchMoviesByGenre('Drama');
            expect(result).toEqual([]);
        });

        it('should filter out unreleased movies', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const mockResponse = {
                results: [
                    {
                        id: 1,
                        title: 'Released Movie',
                        release_date: '2020-01-01',
                        genre_ids: [18],
                        vote_average: 8.0,
                        original_language: 'en'
                    },
                    {
                        id: 2,
                        title: 'Unreleased Movie',
                        release_date: futureDateStr,
                        genre_ids: [18],
                        vote_average: 8.0,
                        original_language: 'en'
                    }
                ]
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await searchMoviesByGenre('Drama');
            
            expect(result.length).toBe(1);
            expect(result[0].title).toBe('Released Movie');
        });
    });

    describe('getMovieDetails', () => {
        it('should fetch full movie details from API', async () => {
            const mockResponse = {
                id: 123,
                title: 'Test Movie',
                release_date: '2020-01-01',
                genres: [{ id: 18, name: 'Drama' }],
                vote_average: 8.0,
                overview: 'Test overview',
                poster_path: '/poster.jpg',
                credits: {
                    crew: [{ job: 'Director', name: 'Test Director' }],
                    cast: [{ name: 'Actor 1' }, { name: 'Actor 2' }]
                },
                original_language: 'en'
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await getMovieDetails('tmdb_123');

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(result).toBeTruthy();
            expect(result.title).toBe('Test Movie');
            expect(result.director).toBe('Test Director');
            expect(result.cast).toHaveLength(2);
        });

        it('should handle invalid movie ID', async () => {
            const result = await getMovieDetails('local_123');
            expect(result).toBeNull();
        });
    });

    describe('getTopRatedMovies', () => {
        it('should fetch top rated movies with correct sorting', async () => {
            const mockResponse = {
                results: [
                    {
                        id: 1,
                        title: 'Top Movie',
                        release_date: '2020-01-01',
                        genre_ids: [18],
                        vote_average: 9.0,
                        original_language: 'en'
                    }
                ]
            };

            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            await getTopRatedMovies(1, 20, 'most_rated');

            expect(fetch).toHaveBeenCalledTimes(1);
            const callUrl = fetch.mock.calls[0][0];
            expect(callUrl).toContain('sort_by=vote_average.desc');
        });
    });
});

describe('MovieApiService - Caching', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetch.mockClear();
        // Reset timers
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should cache API responses', async () => {
        const mockResponse = {
            results: [
                {
                    id: 1,
                    title: 'Cached Movie',
                    release_date: '2020-01-01',
                    genre_ids: [18],
                    vote_average: 8.0,
                    original_language: 'en'
                }
            ]
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        // First call - should fetch from API
        const result1 = await searchMoviesByGenre('Drama');
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(result1[0].title).toBe('Cached Movie');

        // Second call - should use cache
        const result2 = await searchMoviesByGenre('Drama');
        expect(fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
        expect(result2[0].title).toBe('Cached Movie');
    });

    it('should expire cache after 5 minutes', async () => {
        const mockResponse = {
            results: [
                {
                    id: 1,
                    title: 'Cached Movie',
                    release_date: '2020-01-01',
                    genre_ids: [18],
                    vote_average: 8.0,
                    original_language: 'en'
                }
            ]
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        // First call
        await searchMoviesByGenre('Drama');
        expect(fetch).toHaveBeenCalledTimes(1);

        // Advance time by 5 minutes and 1 second
        vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

        // Second call - cache should be expired
        await searchMoviesByGenre('Drama');
        expect(fetch).toHaveBeenCalledTimes(2); // Should fetch again
    });

    it('should use different cache keys for different parameters', async () => {
        const mockResponse1 = {
            results: [{ id: 1, title: 'Movie 1', release_date: '2020-01-01', genre_ids: [18], vote_average: 8.0, original_language: 'en' }]
        };
        const mockResponse2 = {
            results: [{ id: 2, title: 'Movie 2', release_date: '2021-01-01', genre_ids: [18], vote_average: 8.0, original_language: 'en' }]
        };

        fetch
            .mockResolvedValueOnce({ ok: true, json: async () => mockResponse1 })
            .mockResolvedValueOnce({ ok: true, json: async () => mockResponse2 });

        // Different parameters should create different cache entries
        await searchMoviesByGenre('Drama', { minRating: 7.0 });
        await searchMoviesByGenre('Drama', { minRating: 8.0 });

        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe('MovieApiService - Performance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetch.mockClear();
    });

    it('should make parallel API calls for merged genres', async () => {
        const mockResponse = {
            results: [
                {
                    id: 1,
                    title: 'Test Movie',
                    release_date: '2020-01-01',
                    genre_ids: [28],
                    vote_average: 8.0,
                    original_language: 'en'
                }
            ]
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const startTime = Date.now();
        await searchMoviesByGenre('Aksiyon/Macera'); // This is a merged category
        const endTime = Date.now();

        // Should make 2 parallel calls (one for Action, one for Adventure)
        expect(fetch).toHaveBeenCalledTimes(2);
        
        // Should complete quickly due to parallel execution
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(200);
    });

    it('should handle rate limiting efficiently', async () => {
        const mockResponse = {
            results: [
                {
                    id: 1,
                    title: 'Test Movie',
                    release_date: '2020-01-01',
                    genre_ids: [18],
                    vote_average: 8.0,
                    original_language: 'en'
                }
            ]
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        // checkRateLimit should be called before each API call
        await searchMoviesByGenre('Drama');
        
        expect(apiConfig.checkRateLimit).toHaveBeenCalled();
    });

    it('should optimize by not fetching full details for list views', async () => {
        const mockResponse = {
            results: Array.from({ length: 20 }, (_, i) => ({
                id: i + 1,
                title: `Movie ${i + 1}`,
                release_date: '2020-01-01',
                genre_ids: [18],
                vote_average: 8.0,
                original_language: 'en'
            }))
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const startTime = Date.now();
        const result = await searchMoviesByGenre('Drama', { limit: 20 });
        const endTime = Date.now();

        // Should only make 1 API call (not 20 for details)
        expect(fetch).toHaveBeenCalledTimes(1);
        
        // Should return 20 movies
        expect(result.length).toBe(20);
        
        // Should be fast (no additional detail fetches)
        const duration = endTime - startTime;
        expect(duration).toBeLessThan(500);
    });
});

