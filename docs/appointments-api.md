# Appointment API examples

## POST `/api/appointments/request`

**Request**
```json
{
  "clinicId": "harbor-womens",
  "preferredStart": "2024-09-12T01:00:00.000Z",
  "preferredEnd": "2024-09-12T01:30:00.000Z",
  "patientName": "Alex Patient",
  "patientPhone": "+81 90 1234 5678",
  "patientEmail": "alex@example.com",
  "note": "First visit, mild fever",
  "serviceId": "first-visit",
  "specialization": "General Physician",
  "doctorName": "Dr. Hayashi",
  "slot": "10:00 AM"
}
```

**Response**
```json
{
  "success": true,
  "id": "66d0f548e8b4c68f6d3bd6f9",
  "appointment": {
    "_id": "66d0f548e8b4c68f6d3bd6f9",
    "date": "2024-09-12T01:00:00.000Z",
    "dateKey": "2024-09-12",
    "slot": "10:00 AM",
    "preferredStart": "2024-09-12T01:00:00.000Z",
    "preferredEnd": "2024-09-12T01:30:00.000Z",
    "status": "PENDING_CLINIC",
    "specialization": "General Physician",
    "doctorName": "Dr. Hayashi",
    "clinicId": "harbor-womens",
    "notes": "First visit, mild fever",
    "patientId": "66d0f33ae8b4c68f6d3bd6f2",
    "patientName": "Alex Patient",
    "patientPhone": "+81 90 1234 5678",
    "patientEmail": "alex@example.com",
    "createdAt": "2024-08-30T02:20:24.142Z",
    "updatedAt": "2024-08-30T02:20:24.142Z"
  },
  "message": "Request received. Awaiting clinic confirmation."
}
```

## POST `/api/appointments/:id/confirm`

**Request**
```json
{
  "clinicConfirmationToken": "raw-clinic-token",
  "confirmedStart": "2024-09-12T02:00:00.000Z",
  "confirmedEnd": "2024-09-12T02:30:00.000Z"
}
```

**Response**
```json
{
  "success": true,
  "appointment": {
    "_id": "66d0f548e8b4c68f6d3bd6f9",
    "date": "2024-09-12T02:00:00.000Z",
    "dateKey": "2024-09-12",
    "slot": "11:00 AM",
    "preferredStart": "2024-09-12T01:00:00.000Z",
    "preferredEnd": "2024-09-12T01:30:00.000Z",
    "confirmedStart": "2024-09-12T02:00:00.000Z",
    "confirmedEnd": "2024-09-12T02:30:00.000Z",
    "status": "CONFIRMED",
    "specialization": "General Physician",
    "doctorName": "Dr. Hayashi",
    "clinicId": "harbor-womens",
    "notes": "First visit, mild fever",
    "patientId": "66d0f33ae8b4c68f6d3bd6f2",
    "patientName": "Alex Patient",
    "patientPhone": "+81 90 1234 5678",
    "patientEmail": "alex@example.com",
    "createdAt": "2024-08-30T02:20:24.142Z",
    "updatedAt": "2024-08-30T02:32:05.000Z"
  },
  "message": "Appointment confirmed successfully"
}
```

## POST `/api/appointments/:id/decline`

**Request**
```json
{
  "clinicConfirmationToken": "raw-clinic-token",
  "declineReason": "No clinician available at that time"
}
```

**Response**
```json
{
  "success": true,
  "appointment": {
    "_id": "66d0f548e8b4c68f6d3bd6f9",
    "date": "2024-09-12T01:00:00.000Z",
    "dateKey": "2024-09-12",
    "slot": "10:00 AM",
    "preferredStart": "2024-09-12T01:00:00.000Z",
    "preferredEnd": "2024-09-12T01:30:00.000Z",
    "status": "DECLINED",
    "declineReason": "No clinician available at that time",
    "specialization": "General Physician",
    "doctorName": "Dr. Hayashi",
    "clinicId": "harbor-womens",
    "notes": "First visit, mild fever",
    "patientId": "66d0f33ae8b4c68f6d3bd6f2",
    "patientName": "Alex Patient",
    "patientPhone": "+81 90 1234 5678",
    "patientEmail": "alex@example.com",
    "createdAt": "2024-08-30T02:20:24.142Z",
    "updatedAt": "2024-08-30T02:35:02.000Z"
  },
  "message": "Appointment request declined"
}
```

## PATCH `/api/appointments/:id/reschedule`

**Request**
```json
{
  "date": "2024-09-15T01:00:00.000Z",
  "slot": "10:00 AM",
  "reason": "Travel conflict"
}
```

**Response**
```json
{
  "success": true,
  "appointment": {
    "_id": "66d0f548e8b4c68f6d3bd6f9",
    "date": "2024-09-15T01:00:00.000Z",
    "dateKey": "2024-09-15",
    "slot": "10:00 AM",
    "preferredStart": "2024-09-15T01:00:00.000Z",
    "preferredEnd": "2024-09-15T01:30:00.000Z",
    "status": "PENDING_CLINIC",
    "specialization": "General Physician",
    "doctorName": "Dr. Hayashi",
    "clinicId": "harbor-womens",
    "notes": "First visit, mild fever",
    "patientId": "66d0f33ae8b4c68f6d3bd6f2",
    "patientName": "Alex Patient",
    "patientPhone": "+81 90 1234 5678",
    "patientEmail": "alex@example.com",
    "createdAt": "2024-08-30T02:20:24.142Z",
    "updatedAt": "2024-08-30T02:38:15.000Z"
  },
  "message": "Request updated and sent to the clinic for confirmation"
}
```

## PATCH `/api/appointments/:id/cancel`

**Request**
```json
{
  "reason": "Symptoms resolved"
}
```

**Response**
```json
{
  "success": true,
  "message": "Appointment cancelled successfully"
}
```

## GET `/api/appointments`

**Response**
```json
{
  "appointments": [
    {
      "_id": "66d0f548e8b4c68f6d3bd6f9",
      "date": "2024-09-12T02:00:00.000Z",
      "dateKey": "2024-09-12",
      "slot": "11:00 AM",
      "preferredStart": "2024-09-12T01:00:00.000Z",
      "preferredEnd": "2024-09-12T01:30:00.000Z",
      "confirmedStart": "2024-09-12T02:00:00.000Z",
      "confirmedEnd": "2024-09-12T02:30:00.000Z",
      "status": "CONFIRMED",
      "specialization": "General Physician",
      "doctorName": "Dr. Hayashi",
      "clinicId": "harbor-womens",
      "notes": "First visit, mild fever",
      "patientId": "66d0f33ae8b4c68f6d3bd6f2",
      "patientName": "Alex Patient",
      "patientPhone": "+81 90 1234 5678",
      "patientEmail": "alex@example.com",
      "createdAt": "2024-08-30T02:20:24.142Z",
      "updatedAt": "2024-08-30T02:32:05.000Z"
    }
  ]
}
```

## GET `/api/appointments/me`

**Response**
```json
{
  "appointments": [
    {
      "_id": "66d0f548e8b4c68f6d3bd6f9",
      "date": "2024-09-12T01:00:00.000Z",
      "dateKey": "2024-09-12",
      "slot": "10:00 AM",
      "preferredStart": "2024-09-12T01:00:00.000Z",
      "preferredEnd": "2024-09-12T01:30:00.000Z",
      "status": "PENDING_CLINIC",
      "specialization": "General Physician",
      "doctorName": "Dr. Hayashi",
      "clinicId": "harbor-womens",
      "notes": "First visit, mild fever",
      "patientId": "66d0f33ae8b4c68f6d3bd6f2",
      "patientName": "Alex Patient",
      "patientPhone": "+81 90 1234 5678",
      "patientEmail": "alex@example.com",
      "createdAt": "2024-08-30T02:20:24.142Z",
      "updatedAt": "2024-08-30T02:20:24.142Z"
    }
  ]
}
```
