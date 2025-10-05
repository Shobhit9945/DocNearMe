import { BottomNav } from "@/components/BottomNav";
import { User } from "lucide-react";

export default function Profile() {
  return (
    <div className="min-h-screen bg-[#FAFAFE] pb-28 md:bg-gray-100">
      <div className="md:max-w-md md:mx-auto md:shadow-xl md:min-h-screen md:bg-[#FAFAFE]">
      <header className="bg-white px-3.5 sm:px-4 py-6 shadow-sm">
        <div className="max-w-md mx-auto w-full">
          <h1 className="text-2xl font-bold text-[#002D55]">Profile</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-3.5 sm:px-4 pt-8 w-full">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="bg-[#0089FF] rounded-full p-4 mb-4">
            <User className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-lg font-bold text-[#002D55] mb-2">Profile Coming Soon</h2>
          <p className="text-sm text-[#929CAD] text-center max-w-xs">
            This feature is under development. You'll be able to manage your profile and settings here.
          </p>
        </div>
      </main>

        <BottomNav />
      </div>
    </div>
  );
}
