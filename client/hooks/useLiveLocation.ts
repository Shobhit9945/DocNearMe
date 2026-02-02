import { useEffect, useState } from "react";

export const DEFAULT_ADDRESS =
  "AP House 5, Ritsumeikan APU, Jumonjibaru 1-5, Beppu City, Oita 874-0011";
const GEOCODING_PROXY_BASE = "/api/google-maps/geocode";
const MANUAL_LOCATION_KEY = "docnearme_manual_location";

type GeocodingResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{ formatted_address?: string }>;
};

type GeocodingErrorContext = {
  status?: string;
  errorMessage?: string;
  httpStatus?: number;
};

export const getGeocodingErrorMessage = ({
  status,
  errorMessage,
  httpStatus,
}: GeocodingErrorContext): string => {
  switch (status) {
    case "REQUEST_DENIED":
      return "Geocoding request denied. Please verify your API key, billing, and restrictions.";
    case "OVER_QUERY_LIMIT":
      return "Geocoding quota exceeded. Please try again later.";
    case "INVALID_REQUEST":
      return "Geocoding request was invalid. Please try again.";
    case "ZERO_RESULTS":
      return "No address results found for this location.";
    default:
      break;
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return "Geocoding request unauthorized. Please verify your Google Maps API key.";
  }

  if (httpStatus && httpStatus >= 500) {
    return "Geocoding service is unavailable. Please try again later.";
  }

  if (errorMessage) {
    return errorMessage;
  }

  return "Geocoding service failed. Showing default address.";
};

export const parseGeocodingResponse = (
  data: GeocodingResponse,
  httpStatus?: number,
): string => {
  if (data?.status && data.status !== "OK") {
    throw new Error(
      getGeocodingErrorMessage({
        status: data.status,
        errorMessage: data.error_message,
        httpStatus,
      }),
    );
  }

  const formattedAddress = data.results?.[0]?.formatted_address;
  if (formattedAddress) {
    return formattedAddress;
  }

  throw new Error(
    getGeocodingErrorMessage({
      status: data?.status,
      errorMessage: data?.error_message,
      httpStatus,
    }),
  );
};

const getGoogleMapsAddress = async (lat: number, lon: number) => {
  const url = `${GEOCODING_PROXY_BASE}?latlng=${lat},${lon}`;

  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url);
      let data: GeocodingResponse | null = null;

      try {
        data = (await response.json()) as GeocodingResponse;
      } catch (parseError) {
        console.warn("Geocoding response was not valid JSON.", parseError);
      }

      if (!response.ok) {
        const message = getGeocodingErrorMessage({
          status: data?.status,
          errorMessage: data?.error_message,
          httpStatus: response.status,
        });
        if (i === 2) throw new Error(message);
        continue;
      }

      return parseGeocodingResponse(data ?? {}, response.status);
    } catch (error) {
      console.error(`Geocoding Attempt ${i + 1} failed:`, error);
      if (i === 2) throw error;
      await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, i)));
    }
  }
};

type LiveLocationState = {
  currentLocation: string;
  locationError: string;
  isFetchingLocation: boolean;
  manualLocation: string | null;
  setManualLocation: (location: string) => void;
  clearManualLocation: () => void;
};

export const useLiveLocation = (): LiveLocationState => {
  const [currentLocation, setCurrentLocation] = useState("Fetching real-time location...");
  const [locationError, setLocationError] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(true);
  const [manualLocation, setManualLocationState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(MANUAL_LOCATION_KEY);
  });

  useEffect(() => {
    if (manualLocation) {
      setCurrentLocation(manualLocation);
      setLocationError("");
      setIsFetchingLocation(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation not supported by this browser.");
      setCurrentLocation(DEFAULT_ADDRESS);
      setIsFetchingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const address = await getGoogleMapsAddress(latitude, longitude);
          setCurrentLocation(address ?? DEFAULT_ADDRESS);
          setLocationError("");
        } catch (e) {
          console.error("Reverse Geocoding Error:", e);
          const message =
            e instanceof Error
              ? e.message
              : "Geocoding service failed. Showing default address.";
          setLocationError(message);
          setCurrentLocation(DEFAULT_ADDRESS);
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation Error:", error);
        let errorMessage = "Could not retrieve location. Showing default address.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please check browser settings.";
        }
        setLocationError(errorMessage);
        setCurrentLocation(DEFAULT_ADDRESS);
        setIsFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [manualLocation]);

  const setManualLocation = (location: string) => {
    const trimmed = location.trim();
    if (!trimmed) return;
    localStorage.setItem(MANUAL_LOCATION_KEY, trimmed);
    setManualLocationState(trimmed);
    setCurrentLocation(trimmed);
    setLocationError("");
    setIsFetchingLocation(false);
  };

  const clearManualLocation = () => {
    localStorage.removeItem(MANUAL_LOCATION_KEY);
    setManualLocationState(null);
    setIsFetchingLocation(true);
  };

  return {
    currentLocation,
    locationError,
    isFetchingLocation,
    manualLocation,
    setManualLocation,
    clearManualLocation,
  };
};
