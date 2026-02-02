import { useEffect, useMemo, useState } from "react";
import { getGeocodingErrorMessage, parseGeocodingResponse } from "@/hooks/useLiveLocation";

const AUTOCOMPLETE_ENDPOINT = "/api/google-maps/places/autocomplete";
const DETAILS_ENDPOINT = "/api/google-maps/places/details";
const GEOCODE_ENDPOINT = "/api/google-maps/geocode";

type PlacesAutocompleteResponse = {
  status?: string;
  error_message?: string;
  predictions?: Array<{
    description?: string;
    place_id?: string;
  }>;
};

type PlacesDetailsResponse = {
  status?: string;
  error_message?: string;
  result?: {
    formatted_address?: string;
  };
};

export type AddressSuggestion = {
  description: string;
  placeId: string;
};

const createSessionToken = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const parseAutocompleteResponse = (data: PlacesAutocompleteResponse, httpStatus?: number): AddressSuggestion[] => {
  if (data?.status && data.status !== "OK") {
    if (data.status === "ZERO_RESULTS") return [];
    throw new Error(
      getGeocodingErrorMessage({
        status: data.status,
        errorMessage: data.error_message,
        httpStatus,
      }),
    );
  }

  return (
    data.predictions
      ?.map((prediction) => ({
        description: prediction.description ?? "",
        placeId: prediction.place_id ?? "",
      }))
      .filter((prediction) => prediction.description && prediction.placeId) ?? []
  );
};

const parseDetailsResponse = (data: PlacesDetailsResponse, httpStatus?: number) => {
  if (data?.status && data.status !== "OK") {
    throw new Error(
      getGeocodingErrorMessage({
        status: data.status,
        errorMessage: data.error_message,
        httpStatus,
      }),
    );
  }

  const formattedAddress = data.result?.formatted_address;
  if (!formattedAddress) {
    throw new Error(
      getGeocodingErrorMessage({
        status: data?.status,
        errorMessage: data?.error_message,
        httpStatus,
      }),
    );
  }

  return formattedAddress;
};

export const useAddressSearch = (input: string) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionToken, setSessionToken] = useState(createSessionToken);

  const normalizedInput = useMemo(() => input.trim(), [input]);

  useEffect(() => {
    if (!normalizedInput) {
      setSuggestions([]);
      setIsLoading(false);
      setError("");
      setSessionToken(createSessionToken());
      return;
    }

    if (normalizedInput.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setError("");
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");

      try {
        const url = `${AUTOCOMPLETE_ENDPOINT}?input=${encodeURIComponent(normalizedInput)}&sessionToken=${sessionToken}`;
        const response = await fetch(url);
        const data = (await response.json()) as PlacesAutocompleteResponse;

        if (!response.ok) {
          throw new Error(
            getGeocodingErrorMessage({
              status: data?.status,
              errorMessage: data?.error_message,
              httpStatus: response.status,
            }),
          );
        }

        setSuggestions(parseAutocompleteResponse(data, response.status));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to fetch address suggestions.");
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [normalizedInput, sessionToken]);

  const fetchPlaceDetails = async (placeId: string) => {
    const response = await fetch(
      `${DETAILS_ENDPOINT}?placeId=${encodeURIComponent(placeId)}&sessionToken=${sessionToken}`,
    );
    const data = (await response.json()) as PlacesDetailsResponse;

    if (!response.ok) {
      throw new Error(
        getGeocodingErrorMessage({
          status: data?.status,
          errorMessage: data?.error_message,
          httpStatus: response.status,
        }),
      );
    }

    setSessionToken(createSessionToken());
    return parseDetailsResponse(data, response.status);
  };

  const geocodeAddress = async (address: string) => {
    const response = await fetch(`${GEOCODE_ENDPOINT}?address=${encodeURIComponent(address)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        getGeocodingErrorMessage({
          status: data?.status,
          errorMessage: data?.error_message,
          httpStatus: response.status,
        }),
      );
    }

    return parseGeocodingResponse(data, response.status);
  };

  return {
    suggestions,
    isLoading,
    error,
    fetchPlaceDetails,
    geocodeAddress,
  };
};
