import { Star } from "lucide-react";
import { useGooglePlaceDetails } from "@/hooks/useGooglePlaceDetails";

interface GoogleReviewsProps {
  placeId: string;
  fallbackRating: number;
}

export function GoogleReviews({ placeId, fallbackRating }: GoogleReviewsProps) {
  const { data, isLoading } = useGooglePlaceDetails(placeId);

  const rating = data?.rating ?? fallbackRating;
  const reviewCount = data?.user_ratings_total;

  if (isLoading) {
     return (
        <>
            <Star className="w-4 h-4 border-none" fill="#B06B00" /> 
            {fallbackRating}
        </>
     )
  }

  return (
    <>
      <Star className="w-4 h-4" fill="#B06B00" /> 
      {rating} 
      {reviewCount !== undefined && (
        <span className="text-xs font-normal ml-1 opacity-80">({reviewCount})</span>
      )}
    </>
  );
}
