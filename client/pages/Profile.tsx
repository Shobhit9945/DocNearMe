import { BottomNav } from "@/components/BottomNav";
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAFE] pb-28 md:bg-gray-100">
      <div className="w-full max-w-screen-md mx-auto md:shadow-xl md:min-h-screen md:bg-[#FAFAFE]">
        <header className="bg-white px-3.5 sm:px-4 py-6 shadow-sm">
          <div className="max-w-full mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#EEE9FF] rounded-full flex items-center justify-center text-[#3A12DB] font-bold">JD</div>
              <h1 className="text-2xl font-bold text-[#002D55]">Profile</h1>
            </div>
            <button onClick={() => navigate('/')} className="text-sm text-[#1648CE]">Back</button>
          </div>
        </header>

        <main className="w-full mx-auto px-3.5 sm:px-4 pt-8 pb-16">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow p-6 text-center">
            <h2 className="text-xl font-bold text-[#002D55]">John Doe</h2>
            <p className="text-sm text-gray-500 mt-1">john.doe@example.com</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="py-2 px-4 bg-[#3A12DB] text-white rounded-lg">Edit Profile</button>
              <button className="py-2 px-4 border border-gray-200 rounded-lg" onClick={() => alert('Signed out (demo)')}>Sign out</button>
            </div>
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
