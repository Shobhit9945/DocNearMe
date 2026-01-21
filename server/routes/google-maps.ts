import { RequestHandler } from "express";

const GOOGLE_MAPS_API_BASE = "https://maps.googleapis.com/maps/api";

const getApiKey = () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("Google Maps API key not configured."), { status: 500 });
  }
  return apiKey;
};

const fetchGoogleMaps = async (url: string) => {
  const response = await fetch(url);
  const text = await response.text();
  return { status: response.status, body: text, headers: response.headers };
};

export const handleGeocode: RequestHandler = async (req, res, next) => {
  try {
    const { latlng, address } = req.query;
    if (!latlng && !address) {
      return res.status(400).json({
        status: "INVALID_REQUEST",
        error_message: "Provide a latlng or address query parameter.",
      });
    }

    const params = new URLSearchParams({
      key: getApiKey(),
    });
    if (latlng) {
      params.set("latlng", String(latlng));
    }
    if (address) {
      params.set("address", String(address));
    }

    const url = `${GOOGLE_MAPS_API_BASE}/geocode/json?${params.toString()}`;
    const result = await fetchGoogleMaps(url);
    res.status(result.status).type("application/json").send(result.body);
  } catch (error) {
    next(error);
  }
};

export const handlePlaceAutocomplete: RequestHandler = async (req, res, next) => {
  try {
    const { input, sessionToken } = req.query;
    if (!input) {
      return res.status(400).json({
        status: "INVALID_REQUEST",
        error_message: "Provide an input query parameter.",
      });
    }

    const params = new URLSearchParams({
      key: getApiKey(),
      input: String(input),
    });

    if (sessionToken) {
      params.set("sessiontoken", String(sessionToken));
    }

    const url = `${GOOGLE_MAPS_API_BASE}/place/autocomplete/json?${params.toString()}`;
    const result = await fetchGoogleMaps(url);
    res.status(result.status).type("application/json").send(result.body);
  } catch (error) {
    next(error);
  }
};

export const handlePlaceDetails: RequestHandler = async (req, res, next) => {
  try {
    const { placeId, sessionToken } = req.query;
    if (!placeId) {
      return res.status(400).json({
        status: "INVALID_REQUEST",
        error_message: "Provide a placeId query parameter.",
      });
    }

    const params = new URLSearchParams({
      key: getApiKey(),
      place_id: String(placeId),
      fields: "formatted_address,geometry",
    });

    if (sessionToken) {
      params.set("sessiontoken", String(sessionToken));
    }

    const url = `${GOOGLE_MAPS_API_BASE}/place/details/json?${params.toString()}`;
    const result = await fetchGoogleMaps(url);
    res.status(result.status).type("application/json").send(result.body);
  } catch (error) {
    next(error);
  }
};
