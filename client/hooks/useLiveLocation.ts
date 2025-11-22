import { useEffect, useState } from "react";

export const DEFAULT_ADDRESS =
  "AP House 5, Ritsumeikan APU, Jumonjibaru 1-5, Beppu City, Oita 874-0011";
const GEOCODING_PROXY_BASE = "/api/google-maps/geocode";

const getGoogleMapsAddress = async (lat: number, lon: number) => {
  const url = `${GEOCODING_PROXY_BASE}?latlng=${lat},${lon}`;

  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (i === 2) throw new Error(`Geocoding failed with status: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      } else {
        throw new Error("Geocoding: No address results found.");
      }
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
};

export const useLiveLocation = (): LiveLocationState => {
  const [currentLocation, setCurrentLocation] = useState("Fetching real-time location...");
  const [locationError, setLocationError] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(true);

  useEffect(() => {
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
          setLocationError("Geocoding service failed. Showing default address.");
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
  }, []);

  return { currentLocation, locationError, isFetchingLocation };
};
