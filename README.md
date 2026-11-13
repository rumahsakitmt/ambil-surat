# Ambil Surat

Patients and their families get their letters from the hospital on their own phone. A nurse picks the patient on their phone, ticks the letters and shows a QR code; the patient scans it, types the patient's date of birth, and can view and download the letters as PDF for 7 days.

Letters in this version, laid out as SIMRS Khanza prints them:

- Surat Rencana Kontrol (BPJS)
- Surat Keterangan Sakit
- Surat Keterangan Sehat

## How it fits together

```
 hospital network                     internet
┌─────────────────────┐        ┌──────────────────────────────┐
│ SIMRS Khanza (MySQL)│        │ Convex (data)  ◄──  Next.js  │◄── phones
│        ▲ read-only  │        │      ▲                       │
│     bridge/ ────────┼────────┼──────┘ outgoing only         │
└─────────────────────┘        └──────────────────────────────┘
```

- **[bridge/](bridge/README.md)** runs at the hospital. It holds an outgoing connection to Convex, answers the rooms' questions from SIMRS with a SELECT-only database user, and sends the letters a room chose to share. The database is never reachable from outside.
- **Convex** ([convex/](convex)) holds accounts, sessions, the questions waiting for the bridge, the shares and their letters (deleted after 7 days), and the sharing log. Every function checks a secret that only the Next.js server or the bridge hold; browsers never call Convex.
- **Next.js** ([app/](app)) serves the nurse, admin and patient pages.

## Who uses it

- **Rooms** (`/ruang`): one shared account per poli or ward. The first screen lists today's patients of that poli, or the patients in that ward; a search finds any patient by name or record number. A patient's page lists their letters from the last 30 days (older ones a tap away), with today's ticked. *Buat QR* shows the QR; *Sudah dibagikan* lists what still works and revokes it.
- **Admin** (`/admin`): creates, resets and removes room accounts, sees whether the bridge is connected, and reads the sharing log (room, patient, letters, time). The first person to open `/masuk` on a new deployment creates the admin account.
- **Patients and families** (`/s/<token>`): scan, type the date of birth, view and download. Five wrong dates lock the QR for good; the room can share again.

## Run it locally

```sh
bun install
npx convex dev            # creates or uses the dev deployment and writes .env.local
```

Set the secrets the server and the bridge share with Convex:

```sh
npx convex env set APP_SECRET "$(openssl rand -base64 32)"     # and the same value as APP_SECRET in .env.local
npx convex env set BRIDGE_SECRET "$(openssl rand -base64 32)"  # and the same value in bridge/.env
```

Then, in separate terminals:

```sh
cd bridge && npm install && npm start
bun dev
```

Phones on the same network can open the dev server at this computer's address (port 3000); `next.config.ts` allows 192.168.x.x and 10.x.x.x in development.

## Environment

| Where | Name | What |
| --- | --- | --- |
| Next.js | `NEXT_PUBLIC_CONVEX_URL` | The Convex deployment (written by `npx convex dev`). |
| Next.js | `APP_SECRET` | Same value as on the Convex deployment. |
| Next.js | `APP_URL` | Optional: the public address the QR codes point to. Without it, the address the nurse's phone used. |
| Next.js | `HOSPITAL_TIME_ZONE` | Optional, default `Asia/Makassar`. |
| Convex | `APP_SECRET`, `BRIDGE_SECRET` | See above. |
| bridge | see [bridge/.env.example](bridge/.env.example) | |

## Deploy

1. `npx convex deploy`, then set `APP_SECRET` and `BRIDGE_SECRET` on the production deployment.
2. Deploy the Next.js app (for example to Vercel) with `NEXT_PUBLIC_CONVEX_URL`, `APP_SECRET` and `APP_URL`.
3. Point the bridge's `CONVEX_URL` and `BRIDGE_SECRET` at the production deployment and run it at the hospital.
4. Open `/masuk` to create the admin account, then the room accounts.
