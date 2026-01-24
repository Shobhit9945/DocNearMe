import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClinicLogin() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">クリニックログイン (Clinic Login)</h1>
          <p className="text-sm text-gray-500 mt-2">
            管理者メールでログインしてください。わからない場合はDocNearMeまでご連絡ください。
          </p>
        </div>
        <form className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              メールアドレス (Email)
            </label>
            <Input type="email" placeholder="clinic@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              パスワード (Password)
            </label>
            <Input type="password" placeholder="********" />
          </div>
          <Button className="w-full">ログイン (Sign In)</Button>
          <p className="text-xs text-gray-500 text-center">
            初回ログイン情報は担当者から届きます。
          </p>
        </form>
      </div>
    </div>
  );
}
