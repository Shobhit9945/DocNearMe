export interface CalendarEvent {
    title: string;
    description: string;
    location: string;
    startTime: Date;
    endTime: Date;
}

export const generateGoogleCalendarLink = (event: CalendarEvent): string => {
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const start = formatDate(event.startTime);
    const end = formatDate(event.endTime);

    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        details: event.description,
        location: event.location,
        dates: `${start}/${end}`,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const generateICSFile = (event: CalendarEvent): string => {
    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const start = formatDate(event.startTime);
    const end = formatDate(event.endTime);

    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//DocNearMe//Appointment//EN",
        "BEGIN:VEVENT",
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${event.description}`,
        `LOCATION:${event.location}`,
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\n");

    return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;
};
