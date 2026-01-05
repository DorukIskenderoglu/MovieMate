import { describe, it, expect } from 'vitest';
import { getRecommendedMovies } from '../recommendationService.js';

describe('Performance Benchmarks', () => {
    it('should generate recommendations quickly for large datasets', async () => {
        const favorites = [
            { id: 1, title: 'Movie 1', genre: 'Drama', imdb: '8.5' }
        ];
        
        const largeMovieList = Array.from({ length: 5000 }, (_, i) => ({
            id: i + 2,
            title: `Movie ${i + 2}`,
            genre: 'Drama',
            imdb: '8.0',
            director: 'Unknown',
            cast: []
        }));
        
        const startTime = performance.now();
        const recommendations = await getRecommendedMovies(
            largeMovieList,
            favorites,
            false,
            20,
            [],
            [],
            {}
        );
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        
        // Should complete in under 1 second even with 5000 movies
        expect(duration).toBeLessThan(1000);
        expect(recommendations.length).toBe(20);
        
        console.log(`Processed 5000 movies in ${duration.toFixed(2)}ms`);
    });
});

