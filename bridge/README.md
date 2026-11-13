# Ambil Surat bridge

Connects **SIMRS Khanza** to Ambil Surat. It runs on a machine at the hospital that can reach Khanza's database and the internet, and it only makes **outgoing** connections: it holds a live connection to the app's Convex deployment, picks up the questions rooms ask (a patient list, a search, a patient's letters, letters to share), answers them from Khanza read-only and sends the answer back. Nothing connects into the hospital and the database is never exposed.

## What leaves the hospital

Only what a room asks for, when it asks:

- **Room pick lists and searches:** record number, name, date of birth, sex, and one line of context (queue number and doctor, the room in a ward, or the address in a search). The answer is deleted from the cloud as soon as the app has read it, or after two minutes.
- **Rooms:** names and codes of active poli and wards, for the admin's account form.
- **Shared letters:** the contents of the letters a room ticked for one patient, plus that patient's name and date of birth (to check the date of birth the family types). They are deleted when the QR expires (7 days) or is revoked.
- **The letterhead:** the hospital's name, address and contact, its logo and the BPJS logo, once and again when they change.

The bridge never logs patient names; it logs only the kind of question and how long it took.

The queries are in [simrs.ts](simrs.ts). The letter queries are the ones Khanza's own print buttons run, so the letter a patient opens matches the printout.

## Set up

Needs Node 22.18 or newer.

1. A database user that can only read (run as a Khanza database admin; use the bridge machine's address instead of `%` if you can):

   ```sql
   CREATE USER 'ambil_surat'@'%' IDENTIFIED BY 'a-long-password';
   GRANT SELECT ON sik.setting TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.gambar TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.poliklinik TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.bangsal TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.kamar TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.kamar_inap TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.reg_periksa TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.pasien TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.dokter TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.kelurahan TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.kecamatan TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.kabupaten TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.perusahaan_pasien TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.diagnosa_pasien TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.penyakit TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.suratsakit TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.surat_keterangan_sehat TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.bridging_sep TO 'ambil_surat'@'%';
   GRANT SELECT ON sik.bridging_surat_kontrol_bpjs TO 'ambil_surat'@'%';
   ```

   The bridge refuses to start with a user that can change data, and names any of these tables it cannot read.

2. A secret both sides hold, set on the app's Convex deployment:

   ```sh
   npx convex env set BRIDGE_SECRET "$(openssl rand -base64 32)"
   ```

3. On the bridge machine, in this folder:

   ```sh
   npm install
   cp .env.example .env   # fill in the database, CONVEX_URL, the same secret, and the verify settings
   npm run check          # reaches the database and the app once, then stops
   npm start              # keeps running
   ```

   Keep it running with the machine's service manager (systemd, pm2, NSSM on Windows). When SIMRS or the internet is away it says so once and keeps trying; the admin page in the app shows whether the bridge is connected.

## The verification QR

Surat sakit and surat sehat carry the same QR Khanza prints: a link to Khanza's verify page (`VERIFY_URL`) with the letter number encrypted the way `EnkripsiAES.encrypt` does it. `KHANZA_AES_KEY` and `KHANZA_AES_IV` are the two 16-character strings in `KhanzaSecurity16bit/src/AESsecurity/EnkripsiAES.java`. The surat rencana kontrol carries Khanza's signature text instead, as its printout does.

## Notes

- `BRIDGE_DATE=2026-10-23` treats that day as today, for trying it on a copy of the database.
- Only one bridge should run per deployment. A second would answer the same questions twice; nothing breaks, but it is wasted work.
