import React, { useState, useEffect } from "react";
import { Navigation, ClipboardList, Activity, Ambulance } from "lucide-react";
import { BottomNav } from "@/components/BottomNav"; // Assuming this path is correct
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
const GOOGLE_MAPS_API_KEY = import.meta.env.GOOGLE_MAPS_API_KEY;
// Default fallback address
const DEFAULT_ADDRESS = "AP House 5, Ritsumeikan APU, Jumonjibaru 1-5, Beppu City, Oita 874-0011";

// Google Maps API Configuration
// NOTE: In a production app, the API key should be handled securely (e.g., proxied via a backend)
// We set it to "" here, assuming the Canvas environment handles the injection, but you can paste your key here for testing.
//const GOOGLE_MAPS_API_KEY = ""; 
const GEOCODING_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";


/**
 * Converts latitude and longitude to a readable street address using Google Maps Geocoding API.
 */
const getGoogleMapsAddress = async (lat: number, lon: number) => {
  const url = `${GEOCODING_BASE_URL}?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}`;
  
  // Implemented retry logic for robustness
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
          // If 4xx or 5xx error, throw it unless it's the last retry
          if (i === 2) throw new Error(`Geocoding failed with status: ${response.status}`);
          continue; 
      }
      
      const data = await response.json();
      
      // Success check and result extraction
      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      } else {
        throw new Error("Geocoding: No address results found.");
      }
    } catch (error) {
      console.error(`Geocoding Attempt ${i + 1} failed:`, error);
      if (i === 2) throw error; // Re-throw error after final failed attempt
      // Exponential backoff wait
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
    }
  }
};


export default function Index() {
  const navigate = useNavigate();
  // State for location information
  const [currentLocation, setCurrentLocation] = useState("Fetching real-time location...");
  const [locationError, setLocationError] = useState("");


  useEffect(() => {
    // 1. Check for geolocation support
    if ("geolocation" in navigator) {
      // 2. Get the current position (coordinates)
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // 3. Reverse Geocode the coordinates using Google Maps API
            const address = await getGoogleMapsAddress(latitude, longitude);
            
            // 4. Update the state with the real address
            setCurrentLocation(address);
            setLocationError("");
          } catch (e) {
            console.error("Reverse Geocoding Error:", e);
            setLocationError("Geocoding service failed. Showing default address.");
            setCurrentLocation(DEFAULT_ADDRESS);
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
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation not supported by this browser.");
      setCurrentLocation(DEFAULT_ADDRESS);
    }
  }, []); // Empty dependency array, runs once on mount


  return (
    <div className="min-h-screen bg-[#FAFAFE] pb-28 md:bg-gray-100">
      <div className="md:max-w-md md:mx-auto md:shadow-xl md:min-h-screen md:bg-[#FAFAFE]">
        {/* Header */}
        <header className="bg-white px-3.5 sm:px-4 pt-12 pb-4">
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Navigation className="w-8 h-8 text-[#0089FF] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {/* Live location display */}
                <p className={`text-xs font-bold leading-[1.2] ${locationError ? 'text-red-500' : 'text-black'}`}>
                  {currentLocation}
                </p>
                {locationError && (
                     <p className="text-[10px] text-red-500 mt-0.5">{locationError}</p>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <img
                src="/dnm.png"
                alt="DocNearMe Logo"
                className="w-11 h-[53px] object-contain"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-3.5 sm:px-4 pt-2.5 w-full">
        {/* Hero Banner */}
        <div className="relative bg-gradient-to-b from-[#FAFAFE] to-[#E1F6FF] border border-[#D4EBFF] rounded-[10px] shadow-[0_1px_14px_0_#DFE8EC] p-4 mb-3.5 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 z-10">
              <h2 className="text-xs font-bold text-[#002D55] leading-[1.2] mb-1.5">
                APPOINTMENT BOOKING<br />NOW AT YOUR FINGERTIPS
              </h2>
              <h1 className="text-lg font-bold text-[#002D55] leading-[1.2] mb-3">
                WITH DOCNEARME
              </h1>
              <button className="bg-[#002D55] text-white text-[10px] font-normal px-6 py-2 rounded-[10px] shadow-[0_3px_16px_0_rgba(15,39,74,0.10)] hover:bg-[#003366] transition-colors">
                Learn more
              </button>
            </div>
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/94dd9abcae8bb5e056848f9449decbaac63a2b5f?width=312"
              alt="Doctors illustration"
              className="w-[140px] sm:w-[156px] h-auto max-h-[102px] object-contain flex-shrink-0"
            />
          </div>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-5">
          {/* Book Appointment - Navigates to /appointment */}
          <button 
            className="bg-[#0089FF] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-3 sm:p-4 min-h-[88px] flex flex-col items-center justify-center gap-1 hover:bg-[#0077E6] transition-colors"
            onClick={() => navigate('/appointment')} // Navigate to the Appointment screen (which is now the booking screen)
          >
            <ClipboardList className="w-8 h-8 text-white flex-shrink-0" />
            <span className="text-sm font-normal text-[#E4E8EF] text-center leading-[1.2]">
              Book<br />Appointment
            </span>
          </button>

          {/* View Appointments - Placeholder for its original functionality */}
          <button className="bg-[#0089FF] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-3 sm:p-4 min-h-[88px] flex flex-col items-center justify-center gap-1 hover:bg-[#0077E6] transition-colors">
            <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 32 32" fill="none">
              <path d="M4 9.33333V6.66667C4 5.95942 4.28095 5.28115 4.78105 4.78105C5.28115 4.28095 5.95942 4 6.66667 4H9.33333" stroke="white" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22.6667 4H25.3334C26.0406 4 26.7189 4.28095 27.219 4.78105C27.7191 5.28115 28 5.95942 28 6.66667V9.33333" stroke="white" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M28 22.6667V25.3333C28 26.0406 27.7191 26.7188 27.219 27.2189C26.7189 27.719 26.0406 28 25.3334 28H22.6667" stroke="white" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.33333 28H6.66667C5.95942 28 5.28115 27.719 4.78105 27.2189C4.28095 26.7188 4 26.0406 4 25.3333V22.6667" stroke="white" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 20C18.2091 20 20 18.2091 20 16C20 13.7909 18.2091 12 16 12C13.7909 12 12 13.7909 12 16C12 18.2091 13.7909 20 16 20Z" stroke="white" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21.3333 21.3334L18.7999 18.8" stroke="white" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-normal text-[#E4E8EF] text-center leading-[1.2]">
              View<br />Appointments
            </span>
          </button>

          {/* View Medical Records */}
          <button className="bg-[#0089FF] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-3 sm:p-4 min-h-[88px] flex flex-col items-center justify-center gap-1 hover:bg-[#0077E6] transition-colors">
            <Activity className="w-8 h-8 text-white flex-shrink-0" />
            <span className="text-sm font-normal text-[#E4E8EF] text-center leading-[1.2]">
              View Medical<br />Records
            </span>
          </button>

          {/* Emergency SOS */}
          <button className="bg-[#FB4F4F] rounded-[20px] shadow-[2px_0_20px_0_rgba(24,57,107,0.05)] p-3 sm:p-4 min-h-[88px] flex flex-col items-center justify-center gap-1 hover:bg-[#E94444] transition-colors">
            <Ambulance className="w-[42px] h-[30px] text-white flex-shrink-0" />
            <span className="text-sm font-normal text-white text-center leading-[1.2]">
              Emergency<br />SOS
            </span>
          </button>
        </div>

        {/* Info Section */}
        <div className="bg-gradient-to-b from-[#FAFAFE] to-[#D4F5FF] rounded-t-[10px] pt-4 pb-6 -mx-3.5 sm:-mx-4 px-3.5 sm:px-4">
          <h3 className="text-sm font-bold text-black text-center mb-1.5 leading-[1.2]">
            SAVE TIME BY AVOIDING LONG QUEUES
          </h3>
          <p className="text-sm font-normal text-black text-center mb-3.5 leading-[1.2]">
            BOOK YOUR APPOINTMENT WITH THE<br />DOCTOR YOU NEED
          </p>

          {/* Hospital Queue Illustration */}
          <div className="mb-3.5">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/efd1a0a0a615de8dfe2ff92c5e5efa34e4764d7a?width=584"
              alt="Hospital queue illustration"
              className="w-full max-w-[292px] h-auto max-h-[106px] mx-auto rounded-[7px] object-cover"
            />
          </div>

        {/* DOCDAISY Floating Overlay with Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-24 right-4 z-50 w-[260px] sm:w-[300px]"
        >
          <button
            className="w-full bg-[#EEE9FF] border border-[#3A12DB] rounded-[10px] shadow-[0_4px_9px_0_rgba(0,0,0,0.15)] p-3.5 sm:p-4 hover:bg-[#E5DEFF] transition-all"
            onClick={() => navigate('/docdaisy')}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-left min-w-0">
                <h4 className="text-sm font-bold text-black leading-[1.2] mb-0.5">
                  Have any queries?
                </h4>
                <p className="text-base font-bold bg-gradient-to-r from-[#3A12DB] to-transparent bg-clip-text text-transparent leading-[1.2] mb-0.5">
                  DOCDAISY
                </p>
                <p className="text-sm font-bold text-black leading-[1.2] mb-1.5">
                  is here for you!
                </p>
                <p className="text-[11px] font-normal text-black leading-[1.2]">
                  Click on the banner to ask
                </p>
              </div>
              <img
                src="https://api.builder.io/api/v1/image/assets/TEMP/df6e44a93787679647c1cbdaa440c62c2e37e816?width=110"
                alt="DocDaisy AI Assistant"
                className="w-[55px] h-[55px] rounded-[10px] object-cover flex-shrink-0"
              />
            </div>
          </button>
        </motion.div>


        </div>
      </main>

        <BottomNav />
      </div>
    </div>
  );
}
