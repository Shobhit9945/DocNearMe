import { useMemo } from "react";
import { useGooglePlaceDetails } from "@/hooks/useGooglePlaceDetails";
import { formatDistanceLabel, getDistanceKm } from "@/lib/distance";

type ClinicDistanceProps = {
  placeId?: string;
  userCoordinates: { lat: number; lng: number } | null;
  fallback?: string;
};

export function ClinicDistance({ placeId, userCoordinates, fallback = "" }: ClinicDistanceProps) {
  const { data } = useGooglePlaceDetails(placeId);

  const label = useMemo(() => {
    if (!userCoordinates || !data?.geometry?.location) return fallback;
    const distanceKm = getDistanceKm(userCoordinates, data.geometry.location);
    return formatDistanceLabel(distanceKm);
  }, [userCoordinates, data, fallback]);

  if (!label) return null;
  return <>{label}</>;
}
