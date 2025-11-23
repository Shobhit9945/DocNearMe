import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "sqlite.db");
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    specialization TEXT NOT NULL,
    clinicId TEXT,
    notes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed slots if empty
const slotsCount = db.prepare("SELECT count(*) as count FROM slots").get() as { count: number };

if (slotsCount.count === 0) {
    const initialSlots = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
        "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM",
        "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"
    ];

    const insert = db.prepare("INSERT INTO slots (time) VALUES (?)");
    const insertMany = db.transaction((slots: string[]) => {
        for (const slot of slots) insert.run(slot);
    });

    insertMany(initialSlots);
    console.log("Seeded initial time slots");
}

export { db };
