import { RequestHandler } from "express";

const GOOGLE_MAPS_API_BASE = "https://maps.googleapis.com/maps/api";

// MOCK DATA FOR FREE MODE
const MOCK_REVIEWS = [
  {
    author_name: "Kenji Sato",
    profile_photo_url: "https://randomuser.me/api/portraits/men/32.jpg",
    rating: 5,
    relative_time_description: "2 weeks ago",
    text: "Excellent service and very professional staff. The wait time was short and the facilities are modern.",
    time: 1705622400
  },
  {
    author_name: "Sarah Williams",
    profile_photo_url: "https://randomuser.me/api/portraits/women/44.jpg",
    rating: 4,
    relative_time_description: "a month ago",
    text: "Great experience overall. The doctor was very attentive and explained everything clearly in English.",
    time: 1704067200
  },
  {
    author_name: "Yuki Tanaka",
    profile_photo_url: "https://randomuser.me/api/portraits/men/11.jpg",
    rating: 5,
    relative_time_description: "2 months ago",
    text: "非常に親切な対応でした。安心して受診できました。",
    time: 1701388800
  }
];

const getApiKey = () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  // REMOVED: Throwing error forcing API key
  return apiKey || "";
};

const fetchGoogleMaps = async (url: string) => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
     console.log("Using Mock Google Maps Data (No API Key found)");
     return {
        status: 200,
        body: JSON.stringify({
           status: "OK",
           result: {
              name: "Mock Hospital",
              formatted_address: "1-1 Mochigahama, Beppu, Oita, Japan",
              rating: 4.8,
              user_ratings_total: 128,
              reviews: MOCK_REVIEWS,
              geometry: {
                 location: { lat: 33.28, lng: 131.5 }
              }
           }
        }),
        headers: new Headers({'Content-Type': 'application/json'})
     };
  }

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
      fields: "formatted_address,geometry,rating,user_ratings_total,reviews",
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
