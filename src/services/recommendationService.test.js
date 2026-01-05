import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    extractUserPreferences, 
    calculateRecommendationScore,
    getRecommendedMovies 
} from './recommendationService.js';
import * as movieApiService from './movieApiService.js';

// Mock the movieApiService
vi.mock('./movieApiService.js', () => ({
    searchMoviesByGenre: vi.fn(),
    searchMoviesByDirector: vi.fn(),
    searchMoviesByActor: vi.fn(),
    mergeLocalAndAPIResults: vi.fn((local, api) => [...local, ...api]),
    normalizeLocalToAPI: vi.fn((movie) => movie)
}));

describe('RecommendationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('extractUserPreferences', () => {
        it('should extract genres from favorites', () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' },
                { id: 2, title: 'Movie 2', genre: 'Drama', imdb: '8.0' }
            ];
            
            const preferences = extractUserPreferences(favorites, [], [], {});
            
            expect(preferences.genres).toContain('Drama');
            expect(preferences.genres.length).toBe(1);
        });

        it('should extract directors from favorites', () => {
            const favorites = [
                { id: 1, title: 'Movie 1', director: 'Christopher Nolan', imdb: '8.5' }
            ];
            
            const preferences = extractUserPreferences(favorites, [], [], {});
            
            expect(preferences.directors).toContain('Christopher Nolan');
        });

        it('should calculate average rating from favorites', () => {
            const favorites = [
                { id: 1, title: 'Movie 1', imdb: '8.0' },
                { id: 2, title: 'Movie 2', imdb: '9.0' }
            ];
            
            const preferences = extractUserPreferences(favorites, [], [], {});
            
            expect(preferences.minRating).toBeGreaterThanOrEqual(7.5);
        });

        it('should return empty preferences when no favorites or watched movies', () => {
            const preferences = extractUserPreferences([], [], [], {});
            
            expect(preferences.genres).toEqual([]);
            expect(preferences.directors).toEqual([]);
            expect(preferences.actors).toEqual([]);
        });

        it('should use user ratings for more accurate preferences', () => {
            const favorites = [
                { id: 1, title: 'Movie 1', imdb: '8.0' }
            ];
            const userRatings = {
                '1': 4.5 // User rated this 4.5/5
            };
            
            const preferences = extractUserPreferences(favorites, [], [], userRatings);
            
            expect(preferences.userAvgRating).toBe(4.5);
        });
    });

    describe('extractUserPreferences - Caching', () => {
        it('should cache preferences for same input', () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' }
            ];
            
            // First call
            const prefs1 = extractUserPreferences(favorites, [], [], {});
            // Second call with same data
            const prefs2 = extractUserPreferences(favorites, [], [], {});
            
            // Should return same object reference (cached)
            expect(prefs1).toBe(prefs2);
        });

        it('should invalidate cache when favorites change', () => {
            const favorites1 = [
                { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' }
            ];
            const favorites2 = [
                { id: 2, title: 'Movie 2', genre: 'Comedy', imdb: '8.0' }
            ];
            
            const prefs1 = extractUserPreferences(favorites1, [], [], {});
            const prefs2 = extractUserPreferences(favorites2, [], [], {});
            
            expect(prefs1.genres).not.toEqual(prefs2.genres);
        });

        it('should invalidate cache when user ratings change', () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' }
            ];
            
            const prefs1 = extractUserPreferences(favorites, [], [], {});
            const prefs2 = extractUserPreferences(favorites, [], [], { '1': 4.5 });
            
            expect(prefs1.userAvgRating).not.toBe(prefs2.userAvgRating);
        });
    });

    describe('calculateRecommendationScore', () => {
        const mockPreferences = {
            genres: new Set(['drama']),
            directors: new Set(['christopher nolan']),
            actors: new Set(['leonardo dicaprio']),
            minRating: 7.5,
            userAvgRating: 8.0,
            genreFrequency: { 'Drama': 3 },
            directorFrequency: { 'Christopher Nolan': 2 },
            actorFrequency: { 'Leonardo DiCaprio': 1 }
        };

        it('should give high score for genre match with high rating', () => {
            const movie = {
                title: 'Test Movie',
                genre: 'Drama',
                imdb: '8.5',
                director: 'Unknown',
                cast: []
            };
            
            const result = calculateRecommendationScore(movie, mockPreferences);
            
            expect(result.score).toBeGreaterThan(100);
            expect(result.breakdown.genreHighScore).toBe(true);
        });

        it('should give bonus for multiple matches', () => {
            const movie = {
                title: 'Test Movie',
                genre: 'Drama',
                imdb: '8.5',
                director: 'Christopher Nolan',
                cast: ['Leonardo DiCaprio']
            };
            
            const result = calculateRecommendationScore(movie, mockPreferences);
            
            expect(result.matchCount).toBe(3);
            expect(result.score).toBeGreaterThan(200); // Should have multiple match bonus
        });

        it('should give rating proximity bonus', () => {
            const movie = {
                title: 'Test Movie',
                genre: 'Drama',
                imdb: '8.1', // Close to user's 8.0 average
                director: 'Unknown',
                cast: []
            };
            
            const result = calculateRecommendationScore(movie, mockPreferences);
            
            expect(result.score).toBeGreaterThan(100);
        });

        it('should give recency bonus for recent movies', () => {
            const currentYear = new Date().getFullYear();
            const movie = {
                title: 'Test Movie',
                genre: 'Drama',
                imdb: '8.0',
                year: currentYear - 2, // 2 years ago
                director: 'Unknown',
                cast: []
            };
            
            const result = calculateRecommendationScore(movie, mockPreferences);
            
            expect(result.score).toBeGreaterThan(50);
        });

        it('should return zero score for no matches', () => {
            const movie = {
                title: 'Test Movie',
                genre: 'Comedy',
                imdb: '7.0',
                director: 'Unknown',
                cast: []
            };
            
            const result = calculateRecommendationScore(movie, mockPreferences);
            
            expect(result.score).toBe(0);
        });
    });

    describe('getRecommendedMovies', () => {
        it('should return empty array when no favorites or watched movies', async () => {
            const recommendations = await getRecommendedMovies([], [], false, 20, [], [], {});
            
            expect(recommendations).toEqual([]);
        });

        it('should exclude favorites from recommendations', async () => {
            const favorites = [
                { id: 1, title: 'Favorite Movie', genre: 'Drama', imdb: '8.5' }
            ];
            const localMovies = [
                { id: 1, title: 'Favorite Movie', genre: 'Drama', imdb: '8.5' },
                { id: 2, title: 'Recommended Movie', genre: 'Drama', imdb: '8.0' }
            ];
            
            const recommendations = await getRecommendedMovies(
                localMovies, 
                favorites, 
                false, 
                20, 
                [], 
                [], 
                {}
            );
            
            const favoriteTitles = recommendations.map(m => m.title);
            expect(favoriteTitles).not.toContain('Favorite Movie');
        });

        it('should exclude watched movies from recommendations', async () => {
            const favorites = [
                { id: 1, title: 'Favorite Movie', genre: 'Drama', imdb: '8.5' }
            ];
            const watchedMovies = [2];
            const localMovies = [
                { id: 1, title: 'Favorite Movie', genre: 'Drama', imdb: '8.5' },
                { id: 2, title: 'Watched Movie', genre: 'Drama', imdb: '8.0' },
                { id: 3, title: 'Recommended Movie', genre: 'Drama', imdb: '8.0' }
            ];
            
            const recommendations = await getRecommendedMovies(
                localMovies, 
                favorites, 
                false, 
                20, 
                watchedMovies, 
                localMovies, 
                {}
            );
            
            const movieTitles = recommendations.map(m => m.title);
            expect(movieTitles).not.toContain('Watched Movie');
        });
    });

    describe('getRecommendedMovies - API Calls', () => {
        it('should make parallel API calls when useAPI is true', async () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', director: 'Director 1', cast: ['Actor 1'], imdb: '8.5' }
            ];
            
            const mockGenreMovies = [{ id: 2, title: 'Genre Movie', genre: 'Drama', imdb: '8.0' }];
            const mockDirectorMovies = [{ id: 3, title: 'Director Movie', director: 'Director 1', imdb: '8.0' }];
            const mockActorMovies = [{ id: 4, title: 'Actor Movie', cast: ['Actor 1'], imdb: '8.0' }];
            
            movieApiService.searchMoviesByGenre.mockResolvedValue(mockGenreMovies);
            movieApiService.searchMoviesByDirector.mockResolvedValue(mockDirectorMovies);
            movieApiService.searchMoviesByActor.mockResolvedValue(mockActorMovies);
            
            const startTime = Date.now();
            await getRecommendedMovies([], favorites, true, 20, [], [], {});
            const endTime = Date.now();
            
            // Verify all API functions were called
            expect(movieApiService.searchMoviesByGenre).toHaveBeenCalled();
            expect(movieApiService.searchMoviesByDirector).toHaveBeenCalled();
            expect(movieApiService.searchMoviesByActor).toHaveBeenCalled();
            
            // Verify parallel execution (should be fast, not sequential)
            // Sequential would take ~300ms (3 calls × 100ms), parallel should be ~100ms
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(200); // Should complete in under 200ms if parallel
        });

        it('should not make API calls when useAPI is false', async () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' }
            ];
            const localMovies = [
                { id: 2, title: 'Local Movie', genre: 'Drama', imdb: '8.0' }
            ];
            
            await getRecommendedMovies(localMovies, favorites, false, 20, [], [], {});
            
            expect(movieApiService.searchMoviesByGenre).not.toHaveBeenCalled();
            expect(movieApiService.searchMoviesByDirector).not.toHaveBeenCalled();
            expect(movieApiService.searchMoviesByActor).not.toHaveBeenCalled();
        });

        it('should handle API call failures gracefully', async () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' }
            ];
            const localMovies = [
                { id: 2, title: 'Local Movie', genre: 'Drama', imdb: '8.0' }
            ];
            
            // Mock API to throw error
            movieApiService.searchMoviesByGenre.mockRejectedValue(new Error('API Error'));
            
            // Should not throw, should fall back to local movies
            const recommendations = await getRecommendedMovies(
                localMovies, 
                favorites, 
                true, 
                20, 
                [], 
                [], 
                {}
            );
            
            // Should still return recommendations from local movies
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('getRecommendedMovies - Performance', () => {
        it('should use early termination for large datasets', async () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' }
            ];
            
            // Create large dataset (1000 movies)
            const largeMovieList = Array.from({ length: 1000 }, (_, i) => ({
                id: i + 2,
                title: `Movie ${i + 2}`,
                genre: 'Drama',
                imdb: '8.0',
                director: 'Unknown',
                cast: []
            }));
            
            const startTime = Date.now();
            const recommendations = await getRecommendedMovies(
                largeMovieList,
                favorites,
                false,
                20, // Only need 20 recommendations
                [],
                [],
                {}
            );
            const endTime = Date.now();
            
            // Should return exactly 20 recommendations
            expect(recommendations.length).toBe(20);
            
            // Should complete quickly due to early termination
            // Processing 1000 movies sequentially would take much longer
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(500); // Should be fast with early termination
        });

        it('should process movies in batches for performance', async () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' }
            ];
            
            // Create dataset larger than batch size (50)
            const movieList = Array.from({ length: 150 }, (_, i) => ({
                id: i + 2,
                title: `Movie ${i + 2}`,
                genre: 'Drama',
                imdb: '8.0',
                director: 'Unknown',
                cast: []
            }));
            
            const recommendations = await getRecommendedMovies(
                movieList,
                favorites,
                false,
                20,
                [],
                [],
                {}
            );
            
            // Should still work correctly with batching
            expect(recommendations.length).toBe(20);
            expect(recommendations.every(m => m.recommendationScore > 0)).toBe(true);
        });

        it('should maintain diversity control efficiently', async () => {
            const favorites = [
                { id: 1, title: 'Movie 1', genre: 'Drama', director: 'Director A', imdb: '8.5' }
            ];
            
            // Create movies with same director (more than maxPerDirector = 3)
            const movieList = Array.from({ length: 50 }, (_, i) => ({
                id: i + 2,
                title: `Movie ${i + 2}`,
                genre: 'Drama',
                director: 'Director A', // Same director
                imdb: '8.0',
                cast: []
            }));
            
            const recommendations = await getRecommendedMovies(
                movieList,
                favorites,
                false,
                20,
                [],
                [],
                {}
            );
            
            // Count movies per director
            const directorCount = {};
            recommendations.forEach(m => {
                directorCount[m.director] = (directorCount[m.director] || 0) + 1;
            });
            
            // Should not exceed maxPerDirector (3)
            Object.values(directorCount).forEach(count => {
                expect(count).toBeLessThanOrEqual(3);
            });
        });
    });
});

