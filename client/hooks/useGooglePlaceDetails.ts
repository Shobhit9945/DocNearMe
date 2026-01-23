import { useQuery } from "@tanstack/react-query";

export interface GoogleReview {
  author_name: string;
  author_url: string;
  language: string;
  original_language: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
  translated: boolean;
}

export interface GooglePlaceDetails {
  rating: number;
  user_ratings_total: number;
  reviews: GoogleReview[];
  formatted_address: string;
}

export function useGooglePlaceDetails(placeId: string | undefined) {
  return useQuery({
    queryKey: ["googlePlaceDetails", placeId],
    queryFn: async () => {
      if (!placeId) return null;
      const res = await fetch(`/api/google-maps/places/details?placeId=${placeId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch Google Place details");
      }
      const data = await res.json();
      return data.result as GooglePlaceDetails;
    },
    enabled: !!placeId,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
