# DocNearMe Patient iOS (SwiftUI)

This folder contains a SwiftUI-based patient app that connects directly to the DocNearMe API.

## Features covered
- Patient authentication (sign in + sign up)
- Home overview with visit guidance + upcoming visit
- Search clinics and filter by specialization/language
- Clinic detail view with doctors and visit request
- Appointment request flow + upcoming visits
- Medical records list with uploads (photo/PDF)
- Profile view + profile edits
- DocDaisy assistant chat

## Configure the API base URL
By default the app calls `http://localhost:8080`.

To point at a different environment, set this key in UserDefaults:
- `DocNearMeAPIBaseURL`

Example (in Xcode console):
```
UserDefaults.standard.set("https://your-api.example.com", forKey: "DocNearMeAPIBaseURL")
```

## Security and App Store readiness notes
- Auth tokens are stored in the iOS Keychain (not UserDefaults) for App Store-ready credential storage.
- Ensure your App ID, provisioning profile, and code signing are set up in Xcode before archiving.
- Update the deployment target to the latest iOS version you plan to support (e.g., iOS 17+) and test on older devices/simulators you intend to support.
- App Store submission will also require privacy disclosures (Data Safety), app icons, launch screens, and any required usage descriptions in `Info.plist` (e.g., photo library access for uploads).

## Run in Xcode
1. Open Xcode.
2. Create a new iOS App project named **DocNearMePatient**.
3. Replace the generated Swift files with the contents of this folder (keep the file names).
4. Build and run on a simulator or device.
