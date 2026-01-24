import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClinicInfo() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">クリニック情報 (Clinic Info)</h1>
        <p className="text-gray-500 mt-1">
          ここで診療時間・料金・写真を簡単に更新できます。
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">基本情報 (Basic Info)</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              クリニック名 (Clinic Name)
            </label>
            <Input defaultValue="DocNearMe Shibuya Clinic" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              住所 (Address)
            </label>
            <Input defaultValue="1-2-3 Shibuya, Tokyo" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              電話番号 (Phone)
            </label>
            <Input defaultValue="03-1234-5678" />
          </div>
          <Button>保存 (Save)</Button>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">診療時間 (Clinic Hours)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                平日 (Weekdays)
              </label>
              <Input defaultValue="09:00 - 18:00" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                土日 (Weekend)
              </label>
              <Input defaultValue="10:00 - 14:00" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              休診日 (Closed Days)
            </label>
            <Input defaultValue="Wednesday, National Holidays" />
          </div>
          <Button variant="outline">時間を更新 (Update Hours)</Button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">料金 (Pricing)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                初診料 (First Visit)
              </label>
              <Input defaultValue="¥3,000" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                再診料 (Follow-up)
              </label>
              <Input defaultValue="¥1,500" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              追加サービス (Other Services)
            </label>
            <textarea
              className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue="PCR test ¥6,000, Vaccination ¥4,500"
            />
          </div>
          <Button>保存 (Save)</Button>
        </section>

        <section className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">写真 (Photos)</h2>
          <div className="grid grid-cols-3 gap-3">
            {["待合室", "受付", "診察室"].map((label) => (
              <div key={label} className="border border-dashed border-gray-300 rounded-lg p-3 text-center">
                <div className="h-20 bg-gray-50 rounded-md mb-2" />
                <p className="text-xs text-gray-500">{label} (Photo)</p>
              </div>
            ))}
          </div>
          <Button variant="outline">写真を追加 (Add Photo)</Button>
        </section>
      </div>
    </div>
  );
}
