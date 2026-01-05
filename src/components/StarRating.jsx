import React, { useState } from 'react';

/**
 * Star Rating Component - 0.5-5 scale with half-star increments
 * Users can click on left half of star for half value, right half for full value
 */
export default function StarRating({ rating, onRatingChange, readonly = false }) {
    const [hoverRating, setHoverRating] = useState(null);
    
    // Rating is 0.5-5 scale (0 means no rating yet)
    // When rating is 0 or null, show empty stars
    const displayRating = hoverRating !== null ? hoverRating : (rating && rating > 0 ? rating : 0);
    
    const handleStarClick = (starValue, isHalf = false) => {
        if (readonly) return;
        // starValue is 1-5, convert to 0.5-5 scale
        // If clicking left half, subtract 0.5
        const newRating = isHalf ? starValue - 0.5 : starValue;
        // Ensure rating is between 0.5 and 5
        const clampedRating = Math.max(0.5, Math.min(5, newRating));
        onRatingChange(clampedRating);
    };
    
    const handleStarHover = (starValue, isHalf = false) => {
        if (readonly) return;
        const hoverValue = isHalf ? starValue - 0.5 : starValue;
        setHoverRating(hoverValue);
    };
    
    const handleMouseLeave = () => {
        if (readonly) return;
        setHoverRating(null);
    };
    
    return (
        <div className="flex items-center gap-1" onMouseLeave={handleMouseLeave}>
            {[1, 2, 3, 4, 5].map((star) => {
                const starRating = displayRating;
                const isFilled = star <= starRating;
                const isHalfFilled = starRating >= star - 0.5 && starRating < star;
                
                return (
                    <div key={star} className="relative inline-block w-8 h-8">
                        {/* Background star (always gray outline) */}
                        <svg
                            className="w-8 h-8 text-gray-600 absolute top-0 left-0 pointer-events-none"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            viewBox="0 0 20 20"
                        >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        
                        {/* Filled star (yellow when filled) */}
                        {(isFilled || isHalfFilled) && (
                            <svg
                                className={`w-8 h-8 text-yellow-400 absolute top-0 left-0 pointer-events-none ${isHalfFilled ? 'overflow-hidden' : ''}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                style={isHalfFilled ? { clipPath: 'inset(0 50% 0 0)' } : {}}
                            >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        )}
                        
                        {/* Left half clickable area (for half-star) */}
                        <button
                            type="button"
                            onClick={() => handleStarClick(star, true)}
                            onMouseEnter={() => handleStarHover(star, true)}
                            disabled={readonly}
                            className={`${readonly ? 'cursor-default' : 'cursor-pointer'} absolute left-0 top-0 w-4 h-8 z-10 opacity-0 hover:opacity-20 bg-yellow-400 transition-opacity`}
                        />
                        
                        {/* Right half clickable area (for full star) */}
                        <button
                            type="button"
                            onClick={() => handleStarClick(star, false)}
                            onMouseEnter={() => handleStarHover(star, false)}
                            disabled={readonly}
                            className={`${readonly ? 'cursor-default' : 'cursor-pointer'} absolute right-0 top-0 w-4 h-8 z-10 opacity-0 hover:opacity-20 bg-yellow-400 transition-opacity`}
                        />
                    </div>
                );
            })}
            {rating && rating > 0 && (
                <span className="ml-2 text-sm text-gray-400 font-semibold">
                    ({rating.toFixed(1)}/5)
                </span>
            )}
        </div>
    );
}
