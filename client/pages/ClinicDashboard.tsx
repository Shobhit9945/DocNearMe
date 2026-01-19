const ClinicDashboard = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <h1 className="text-3xl font-semibold">Clinic Portal</h1>
          <p className="mt-2 text-sm text-slate-300">
            This is the clinic-only dashboard. Add clinic management tools here.
          </p>
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Quick Actions</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>• Review appointment requests</li>
              <li>• Update clinic availability</li>
              <li>• Manage patient messages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicDashboard;
