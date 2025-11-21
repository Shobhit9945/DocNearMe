export default function BookingPage() {
  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">予約する</h1>
        <div className="bg-white rounded-lg shadow-lg p-4">
          <iframe 
            title="予約スケジュール"
            src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0HJDIw8tveChxs7xbgXWJMvnT3kvW2u74hX-2nHjPlqr3y_gyptoAT0T6NRCKPATg7xmkWIzNd?gv=true" 
            style={{ border: 0 }} 
            width="100%" 
            height="600" 
            frameBorder="0"
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
