#!/usr/bin/env python3
import json
import sqlite3
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Brug: python3 export-legacy-pakkeliste.py /sti/til/app.db", file=sys.stderr)
        return 2

    db_path = Path(sys.argv[1]).expanduser().resolve()
    if not db_path.is_file():
        print(f"Databasefilen findes ikke: {db_path}", file=sys.stderr)
        return 2

    connection = sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        tables = {
            row["name"]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        required = {"vehicles", "places", "items"}
        missing = sorted(required - tables)
        if missing:
            raise RuntimeError("Manglende tabeller: " + ", ".join(missing))

        vehicles = []
        for vehicle in connection.execute(
            "SELECT id, name, COALESCE(description, '') AS description, "
            "COALESCE(sort, 0) AS sort FROM vehicles ORDER BY sort, name"
        ):
            vehicle_data = dict(vehicle)
            vehicle_data["places"] = []
            vehicle_data["docs"] = []

            for place in connection.execute(
                "SELECT id, name, COALESCE(sort, 0) AS sort "
                "FROM places WHERE vehicle_id = ? ORDER BY sort, name",
                (vehicle["id"],),
            ):
                place_data = dict(place)
                place_data["items"] = [
                    dict(item)
                    for item in connection.execute(
                        "SELECT id, name, COALESCE(quantity, 1) AS quantity, "
                        "COALESCE(note, '') AS note, COALESCE(sort, 0) AS sort, photo_path "
                        "FROM items WHERE place_id = ? ORDER BY sort, name",
                        (place["id"],),
                    )
                ]
                vehicle_data["places"].append(place_data)

            if "vehicle_docs" in tables:
                vehicle_data["docs"] = [
                    dict(document)
                    for document in connection.execute(
                        "SELECT id, filename, path FROM vehicle_docs "
                        "WHERE vehicle_id = ? ORDER BY id",
                        (vehicle["id"],),
                    )
                ]

            vehicles.append(vehicle_data)

        json.dump(
            {
                "format": "pakkeliste-sbr-legacy",
                "version": 1,
                "source": str(db_path),
                "vehicles": vehicles,
            },
            sys.stdout,
            ensure_ascii=False,
            indent=2,
        )
        sys.stdout.write("\n")
        return 0
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
