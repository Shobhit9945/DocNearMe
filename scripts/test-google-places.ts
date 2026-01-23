import "dotenv/config";

const GOOGLE_MAPS_API_BASE = "https://maps.googleapis.com/maps/api";
const PLACE_ID = "ChIJM0fLQOamRjURHBffbpcNZkE"; // Noguchi Hospital

async function testPlaceDetails() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Error: GOOGLE_MAPS_API_KEY is not set in .env");
    return;
  }

  const params = new URLSearchParams({
    key: apiKey,
    place_id: PLACE_ID,
    fields: "name,rating,user_ratings_total,reviews",
  });

  const url = `${GOOGLE_MAPS_API_BASE}/place/details/json?${params.toString()}`;
  console.log(`Fetching ${url.replace(apiKey, "API_KEY")}...`);

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log("Status:", response.status);
    console.log("Google API Status:", data.status);
    
    if (data.error_message) {
      console.log("Error Message:", data.error_message);
    }

    if (data.result) {
      console.log("Name:", data.result.name);
      console.log("Rating:", data.result.rating);
      console.log("Total Ratings:", data.result.user_ratings_total);
      console.log("Reviews Count:", data.result.reviews?.length);
    } else {
        console.log("No result found in response");
        console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

testPlaceDetails();
