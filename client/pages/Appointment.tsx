import { ChevronLeft } from 'lucide-react';
import { BottomNav } from "@/components/BottomNav";
import { useNavigate } from 'react-router-dom';

export default function Appointment() {
  const navigate = useNavigate();

  // Example list of specializations for the dropdown
  const specializations = [
    "Select Specialization",
    "General Physician",
    "Cardiologist",
    "Dermatologist",
    "Pediatrician",
    "Orthopedic Surgeon",
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFE] pb-28 font-sans md:max-w-md md:mx-auto md:shadow-xl">
      
      {/* Header */}
      <header className="bg-white px-3.5 sm:px-4 pt-12 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          
          <h1 className="text-lg font-bold text-black flex-1 text-center pr-10">
            BOOK YOUR APPOINTMENT
          </h1>
          
          <div className="flex-shrink-0">
            {/* DocNearMe Logo */}
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2F86a46763d0da41ea82c643774e72cb61%2Fe301939e79d74da9908b1799ba2b0d48?format=webp&width=100"
              alt="DocNearMe Logo"
              className="w-11 h-[53px] object-contain"
            />
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-3.5 sm:px-4 pt-4 w-full">
        {/* Hero Banner */}
        <div className="relative bg-gradient-to-b from-[#FAFAFE] to-[#E1F6FF] border border-[#D4EBFF] rounded-[10px] shadow-[0_1px_14px_0_#DFE8EC] p-4 mb-6 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 z-10">
              <h2 className="text-xs font-bold text-[#002D55] leading-[1.2] mb-1.5">
                APPOINTMENT BOOKING<br />NOW AT YOUR FINGERTIPS
              </h2>
              <h1 className="text-lg font-bold text-[#002D55] leading-[1.2] mb-3">
                WITH DOCNEARME
              </h1>
              <button className="bg-[#002D55] text-white text-[10px] font-normal px-6 py-2 rounded-[10px] shadow-[0_3px_16px_0_rgba(15,39,74,0.10)]">
                Learn more
              </button>
            </div>
            {/* Doctors illustration placeholder */}
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/94dd9abcae8bb5e056848f9449decbaac63a2b5f?width=312"
              alt="Doctors illustration"
              className="w-[140px] sm:w-[156px] h-auto max-h-[102px] object-contain flex-shrink-0"
            />
          </div>
        </div>

        {/* Info Section */}
        <div className="text-center mb-6">
          <h3 className="text-sm font-bold text-black mb-1.5 leading-[1.2]">
            SAVE TIME BY AVOIDING LONG QUEUES
          </h3>
          <p className="text-sm font-normal text-black leading-[1.2]">
            BOOK YOUR APPOINTMENT WITH THE<br />DOCTOR YOU NEED
          </p>
        </div>

        {/* Hospital Queue Illustration */}
        <div className="mb-6">
          <img
            src="https://api.builder.io/api/v1/image/assets/TEMP/efd1a0a0a615de8dfe2ff92c5e5efa34e4764d7a?width=584"
            alt="Hospital queue illustration"
            className="w-full max-w-[292px] h-auto max-h-[106px] mx-auto rounded-[7px] object-cover"
          />
        </div>

        {/* DOCDAISY Banner */}
        <div className="bg-[#EEE9FF] border border-[#3A12DB] rounded-[10px] shadow-[0_4px_9px_0_rgba(0,0,0,0.15)] p-3.5 sm:p-4 mb-6 cursor-pointer"
            onClick={() => navigate('/docdaisy')} // Navigate to DocDaisy chat
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
        </div>
        
        {/* Specialization Selector */}
        <div className="mb-8">
          <select 
            defaultValue={specializations[0]}
            className="w-full bg-white border border-gray-300 rounded-[10px] shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] px-4 py-3 appearance-none text-gray-500 font-normal focus:outline-none focus:border-[#0089FF]"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                backgroundSize: '1.2em',
            }}
          >
            {specializations.map((spec, index) => (
              <option key={index} value={spec} disabled={index === 0}>
                {spec}
              </option>
            ))}
          </select>
        </div>

        {/* Proceed Button */}
        <button 
          onClick={() => console.log('Proceeding to next booking step...')}
          className="w-full bg-[#0089FF] text-white text-base font-bold px-6 py-3 rounded-[10px] shadow-[0_4px_10px_0_rgba(0,137,255,0.3)] hover:bg-[#0077E6] transition-colors"
        >
          Proceed
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
