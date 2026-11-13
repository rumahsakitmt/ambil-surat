/**
 * What the bridge reads from SIMRS Khanza, all of it read-only: the rooms, the
 * patients a room picks from, a patient's letters, and the contents of the
 * letters a room chose to share. The letter queries are the ones Khanza's own
 * print buttons run (SuratSakit.java, SuratKeteranganSehat.java,
 * BPJSSuratKontrol.java), so the letter a patient opens matches the printout.
 */
import { createCipheriv } from "node:crypto";

export type Run = (sql: string, params?: unknown[]) => Promise<Record<string, string | null>[]>;

export type LetterType = "kontrol" | "sakit" | "sehat" | "kematian";
export type Item = { type: LetterType; noSurat: string };

/** The tables the bridge's database user must be able to read (see README.md). */
export const TABLES = [
  "setting", "gambar", "poliklinik", "bangsal", "kamar", "kamar_inap", "reg_periksa", "pasien", "dokter",
  "kelurahan", "kecamatan", "kabupaten", "perusahaan_pasien", "diagnosa_pasien", "penyakit",
  "suratsakit", "surat_keterangan_sehat", "bridging_sep", "bridging_surat_kontrol_bpjs", "pasien_mati",
];

const text = (value: unknown) => (value == null ? "" : String(value).trim());

/** Khanza's EnkripsiAES.encrypt: AES-128-CBC with its fixed key and IV, base64. */
export function makeVerifyLink(baseUrl: string, key: string, iv: string) {
  return (kind: "sks" | "sh", noSurat: string) => {
    const cipher = createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
    const payload = `{'x':'${kind}','t':'${noSurat}'}`;
    return baseUrl + Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]).toString("base64");
  };
}

export async function rooms(run: Run) {
  const [poli, bangsal] = await Promise.all([
    run("select kd_poli as code, nm_poli as name from poliklinik where status='1' order by nm_poli"),
    run(
      "select bangsal.kd_bangsal as code, bangsal.nm_bangsal as name from bangsal where bangsal.status='1' " +
        "and bangsal.kd_bangsal in (select kamar.kd_bangsal from kamar where kamar.statusdata='1') order by bangsal.nm_bangsal",
    ),
  ]);
  // Khanza keeps placeholder rows such as a poli named "-"; they aren't rooms.
  const shape = (rows: Record<string, string | null>[]) =>
    rows.map((r) => ({ code: text(r.code), name: text(r.name) })).filter((r) => r.code && r.code !== "-" && /[A-Za-z0-9]/.test(r.name));
  return { poli: shape(poli), bangsal: shape(bangsal) };
}

const PATIENT = "pasien.no_rkm_medis as noRm, pasien.nm_pasien as name, date_format(pasien.tgl_lahir,'%Y-%m-%d') as dob, pasien.jk as sex";
const patient = (r: Record<string, string | null>) => ({
  noRm: text(r.noRm),
  name: text(r.name),
  dob: text(r.dob),
  sex: text(r.sex),
  info: text(r.info),
});

/** A room's pick list: today's patients of a poli, or those in a ward now (and who left it since yesterday). */
export async function patients(run: Run, today: string, room: { kind: string; code: string }) {
  const rows =
    room.kind === "bangsal"
      ? await run(
          `select ${PATIENT}, concat(kamar.kd_kamar, if(kamar_inap.stts_pulang='-','',' · sudah pulang')) as info ` +
            "from kamar_inap inner join kamar on kamar.kd_kamar=kamar_inap.kd_kamar " +
            "inner join reg_periksa on reg_periksa.no_rawat=kamar_inap.no_rawat " +
            "inner join pasien on pasien.no_rkm_medis=reg_periksa.no_rkm_medis " +
            "where kamar.kd_bangsal=? and (kamar_inap.stts_pulang='-' or kamar_inap.tgl_keluar>=date_sub(?, interval 1 day)) " +
            "group by pasien.no_rkm_medis order by kamar_inap.stts_pulang='-' desc, kamar.kd_kamar limit 300",
          [room.code, today],
        )
      : await run(
          `select ${PATIENT}, concat('No. ', reg_periksa.no_reg, ' · ', dokter.nm_dokter) as info ` +
            "from reg_periksa inner join pasien on pasien.no_rkm_medis=reg_periksa.no_rkm_medis " +
            "inner join dokter on dokter.kd_dokter=reg_periksa.kd_dokter " +
            "where reg_periksa.tgl_registrasi=? and reg_periksa.kd_poli=? and reg_periksa.stts<>'Batal' " +
            "order by reg_periksa.no_reg limit 300",
          [today, room.code],
        );
  return rows.map(patient);
}

/** Any patient of the hospital, by part of the name or the whole record number. */
export async function search(run: Run, query: string) {
  const q = query.trim().slice(0, 60);
  if (q.length < 3) return [];
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await run(
    `select ${PATIENT}, pasien.alamat as info from pasien where pasien.nm_pasien like ? or pasien.no_rkm_medis=? order by pasien.nm_pasien limit 30`,
    [like, q],
  );
  return rows.map(patient);
}

/** A patient's letters of the four kinds: the last 30 days (and control dates still ahead), or all of them. */
export async function letters(run: Run, today: string, noRm: string, all: boolean) {
  const since = (column: string) => (all ? "" : ` and ${column}>=date_sub(?, interval 30 day)`);
  const p = all ? [noRm] : [noRm, today];
  const [who, kontrol, sakit, sehat, kematian] = await Promise.all([
    run(`select ${PATIENT}, '' as info from pasien where pasien.no_rkm_medis=?`, [noRm]),
    run(
      "select bridging_surat_kontrol_bpjs.no_surat, date_format(bridging_surat_kontrol_bpjs.tgl_surat,'%Y-%m-%d') as date, " +
        "date_format(bridging_surat_kontrol_bpjs.tgl_rencana,'%Y-%m-%d') as rencana, bridging_surat_kontrol_bpjs.nm_poli_bpjs as poli " +
        "from bridging_surat_kontrol_bpjs inner join bridging_sep on bridging_sep.no_sep=bridging_surat_kontrol_bpjs.no_sep " +
        "where bridging_sep.nomr=?" +
        (all ? "" : " and (bridging_surat_kontrol_bpjs.tgl_surat>=date_sub(?, interval 30 day) or bridging_surat_kontrol_bpjs.tgl_rencana>=?)") +
        " order by bridging_surat_kontrol_bpjs.tgl_surat desc limit 50",
      all ? [noRm] : [noRm, today, today],
    ),
    run(
      "select suratsakit.no_surat, date_format(suratsakit.tanggalawal,'%Y-%m-%d') as date, suratsakit.lamasakit " +
        "from suratsakit inner join reg_periksa on reg_periksa.no_rawat=suratsakit.no_rawat " +
        `where reg_periksa.no_rkm_medis=?${since("suratsakit.tanggalawal")} order by suratsakit.tanggalawal desc limit 50`,
      p,
    ),
    run(
      "select surat_keterangan_sehat.no_surat, date_format(surat_keterangan_sehat.tanggalsurat,'%Y-%m-%d') as date, surat_keterangan_sehat.keperluan " +
        "from surat_keterangan_sehat inner join reg_periksa on reg_periksa.no_rawat=surat_keterangan_sehat.no_rawat " +
        `where reg_periksa.no_rkm_medis=?${since("surat_keterangan_sehat.tanggalsurat")} order by surat_keterangan_sehat.tanggalsurat desc limit 50`,
      p,
    ),
    // One per patient: its "number" is the record number, as Khanza prints it.
    run(
      "select pasien_mati.no_rkm_medis as no_surat, date_format(pasien_mati.tanggal,'%Y-%m-%d') as date, pasien_mati.keterangan " +
        `from pasien_mati where pasien_mati.no_rkm_medis=?${since("pasien_mati.tanggal")}`,
      p,
    ),
  ]);
  if (!who[0]) return null;
  const list = [
    // `rencana` is the control date; the app writes it out ("kontrol 23 Okt 2026").
    ...kontrol.map((r) => ({ type: "kontrol" as const, noSurat: text(r.no_surat), date: text(r.date), detail: text(r.poli), rencana: text(r.rencana) })),
    ...sakit.map((r) => ({ type: "sakit" as const, noSurat: text(r.no_surat), date: text(r.date), detail: `Istirahat ${text(r.lamasakit)} hari` })),
    ...sehat.map((r) => ({ type: "sehat" as const, noSurat: text(r.no_surat), date: text(r.date), detail: text(r.keperluan) })),
    ...kematian.map((r) => ({ type: "kematian" as const, noSurat: text(r.no_surat), date: text(r.date), detail: text(r.keterangan) })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return { patient: patient(who[0]), today, letters: list };
}

const ADDRESS = "concat(pasien.alamat,', ',ifnull(kelurahan.nm_kel,''),', ',ifnull(kecamatan.nm_kec,''),', ',ifnull(kabupaten.nm_kab,''))";
const AREA =
  "left join kelurahan on pasien.kd_kel=kelurahan.kd_kel left join kecamatan on pasien.kd_kec=kecamatan.kd_kec left join kabupaten on pasien.kd_kab=kabupaten.kd_kab ";

type Hospital = { name: string; city: string };
type Link = ReturnType<typeof makeVerifyLink>;

/** One letter's contents, only when it belongs to that patient. */
async function letter(run: Run, noRm: string, item: Item, hospital: Hospital, link: Link) {
  if (item.type === "kontrol") {
    const [r] = await run(
      "select bridging_sep.no_kartu, bridging_sep.nama_pasien, date_format(bridging_sep.tanggal_lahir,'%Y-%m-%d') as tanggal_lahir, bridging_sep.jkel, " +
        "bridging_sep.nmdiagnosaawal, date_format(bridging_surat_kontrol_bpjs.tgl_surat,'%Y-%m-%d') as tgl_surat, bridging_surat_kontrol_bpjs.no_surat, " +
        "date_format(bridging_surat_kontrol_bpjs.tgl_rencana,'%Y-%m-%d') as tgl_rencana, bridging_surat_kontrol_bpjs.nm_dokter_bpjs, bridging_surat_kontrol_bpjs.nm_poli_bpjs " +
        "from bridging_sep inner join bridging_surat_kontrol_bpjs on bridging_surat_kontrol_bpjs.no_sep=bridging_sep.no_sep " +
        "where bridging_surat_kontrol_bpjs.no_surat=? and bridging_sep.nomr=?",
      [item.noSurat, noRm],
    );
    if (!r) return null;
    const [y, m, d] = text(r.tgl_rencana).split("-");
    return {
      noSurat: text(r.no_surat),
      tglRencana: text(r.tgl_rencana),
      tglSurat: text(r.tgl_surat),
      dokter: text(r.nm_dokter_bpjs),
      poli: text(r.nm_poli_bpjs),
      noKartu: text(r.no_kartu),
      nama: text(r.nama_pasien),
      jk: text(r.jkel),
      tglLahir: text(r.tanggal_lahir),
      diagnosa: text(r.nmdiagnosaawal),
      // The text Khanza puts in this letter's QR.
      finger: `Dikeluarkan di ${hospital.name}, Kabupaten/Kota ${hospital.city}\nDitandatangani secara elektronik oleh ${text(r.nm_dokter_bpjs)}\nID ${text(r.tgl_surat)}\n${d}-${m}-${y}`,
    };
  }
  if (item.type === "kematian") {
    // rptSuratKematian2, as DlgPasienMati prints it.
    const [r] = await run(
      "select pasien_mati.no_rkm_medis, date_format(pasien_mati.tanggal,'%d-%m-%Y') as tanggal, time_format(pasien_mati.jam,'%H:%i:%s') as jam, " +
        "pasien_mati.keterangan, pasien_mati.kd_dokter, dokter.nm_dokter, pasien.nm_pasien, pasien.jk, pasien.umur, pasien.alamat " +
        "from pasien_mati inner join pasien on pasien_mati.no_rkm_medis=pasien.no_rkm_medis inner join dokter on pasien_mati.kd_dokter=dokter.kd_dokter " +
        "where pasien_mati.no_rkm_medis=? and pasien_mati.no_rkm_medis=?",
      [item.noSurat, noRm],
    );
    if (!r) return null;
    // Khanza signs with the hash of the doctor's fingerprint when it has one, else the doctor's code.
    // Only the hash is read; without access to those tables the code is used, as Khanza does.
    const [print] = await run(
      "select sha1(sidikjari.sidikjari) as id from sidikjari inner join pegawai on pegawai.id=sidikjari.id where pegawai.nik=?",
      [text(r.kd_dokter)],
    ).catch(() => []);
    return {
      noSurat: text(r.no_rkm_medis),
      nama: text(r.nm_pasien),
      umur: text(r.umur),
      jk: text(r.jk),
      alamat: text(r.alamat),
      tanggal: text(r.tanggal),
      jam: text(r.jam),
      keterangan: text(r.keterangan),
      dokter: text(r.nm_dokter),
      finger: `Dikeluarkan di ${hospital.name}, Kabupaten/Kota ${hospital.city}\nDitandatangani secara elektronik oleh ${text(r.nm_dokter)}\nID ${text(print?.id) || text(r.kd_dokter)}\n${text(r.tanggal)}`,
    };
  }
  if (item.type === "sakit") {
    const [r] = await run(
      "select suratsakit.no_surat, date_format(suratsakit.tanggalawal,'%d-%m-%Y') as tanggalawal, date_format(suratsakit.tanggalakhir,'%d-%m-%Y') as tanggalakhir, suratsakit.lamasakit, " +
        "date_format(reg_periksa.tgl_registrasi,'%d-%m-%Y') as tgl_registrasi, perusahaan_pasien.nama_perusahaan, dokter.nm_dokter, pasien.nm_pasien, pasien.jk, " +
        `concat(reg_periksa.umurdaftar,' ',reg_periksa.sttsumur) as umur, pasien.pekerjaan, ${ADDRESS} as alamat, ` +
        "(select concat(diagnosa_pasien.kd_penyakit,' ',penyakit.nm_penyakit) from diagnosa_pasien inner join penyakit on diagnosa_pasien.kd_penyakit=penyakit.kd_penyakit " +
        "where diagnosa_pasien.no_rawat=suratsakit.no_rawat and diagnosa_pasien.prioritas='1' limit 1) as penyakit " +
        "from suratsakit inner join reg_periksa on reg_periksa.no_rawat=suratsakit.no_rawat " +
        "inner join pasien on reg_periksa.no_rkm_medis=pasien.no_rkm_medis inner join dokter on reg_periksa.kd_dokter=dokter.kd_dokter " +
        "left join perusahaan_pasien on pasien.perusahaan_pasien=perusahaan_pasien.kode_perusahaan " +
        AREA +
        "where suratsakit.no_surat=? and reg_periksa.no_rkm_medis=?",
      [item.noSurat, noRm],
    );
    if (!r) return null;
    return {
      noSurat: text(r.no_surat),
      nama: text(r.nm_pasien),
      umur: text(r.umur),
      jk: text(r.jk),
      pekerjaan: text(r.pekerjaan),
      instansi: text(r.nama_perusahaan),
      alamat: text(r.alamat),
      hari: text(r.lamasakit),
      tanggalAwal: text(r.tanggalawal),
      tanggalAkhir: text(r.tanggalakhir),
      penyakit: text(r.penyakit),
      tglRegistrasi: text(r.tgl_registrasi),
      dokter: text(r.nm_dokter),
      finger: link("sks", text(r.no_surat)),
    };
  }
  const [r] = await run(
    "select surat_keterangan_sehat.no_surat, date_format(surat_keterangan_sehat.tanggalsurat,'%d-%m-%Y') as tanggalsurat, surat_keterangan_sehat.berat, surat_keterangan_sehat.tinggi, " +
      "surat_keterangan_sehat.tensi, surat_keterangan_sehat.suhu, surat_keterangan_sehat.butawarna, surat_keterangan_sehat.keperluan, surat_keterangan_sehat.kesimpulan, " +
      `dokter.nm_dokter, pasien.jk, pasien.nm_pasien, concat(reg_periksa.umurdaftar,' ',reg_periksa.sttsumur) as umur, ${ADDRESS} as alamat ` +
      "from surat_keterangan_sehat inner join reg_periksa on reg_periksa.no_rawat=surat_keterangan_sehat.no_rawat " +
      "inner join pasien on reg_periksa.no_rkm_medis=pasien.no_rkm_medis inner join dokter on reg_periksa.kd_dokter=dokter.kd_dokter " +
      AREA +
      "where surat_keterangan_sehat.no_surat=? and reg_periksa.no_rkm_medis=?",
    [item.noSurat, noRm],
  );
  if (!r) return null;
  return {
    noSurat: text(r.no_surat),
    tanggalSurat: text(r.tanggalsurat),
    berat: text(r.berat),
    tinggi: text(r.tinggi),
    tensi: text(r.tensi),
    suhu: text(r.suhu),
    butaWarna: text(r.butawarna),
    keperluan: text(r.keperluan),
    kesimpulan: text(r.kesimpulan),
    dokter: text(r.nm_dokter),
    jk: text(r.jk),
    nama: text(r.nm_pasien),
    umur: text(r.umur),
    alamat: text(r.alamat),
    finger: link("sh", text(r.no_surat)),
  };
}

/** The letters a room ticked for a patient, ready to hand to the app. */
export async function share(run: Run, noRm: string, items: Item[], hospital: Hospital, link: Link) {
  const [who] = await run("select pasien.nm_pasien as name, date_format(pasien.tgl_lahir,'%Y-%m-%d') as dob from pasien where pasien.no_rkm_medis=?", [noRm]);
  if (!who) throw Error("Pasien tidak ditemukan di SIMRS");
  const out = [];
  for (const item of items.slice(0, 20)) {
    const data = await letter(run, noRm, item, hospital, link);
    if (!data) throw Error(`Surat ${item.noSurat} tidak ditemukan untuk pasien ini`);
    out.push({ type: item.type, noSurat: item.noSurat, data });
  }
  return { patient: { name: text(who.name), dob: text(who.dob) }, letters: out };
}

/** The letterhead: the hospital's name and address, its logo and BPJS's. */
export async function hospital(run: (sql: string) => Promise<Record<string, unknown>[]>) {
  const [s] = await run("select nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email, logo from setting limit 1");
  if (!s) throw Error("Tabel setting kosong");
  const [g] = await run("select bpjs from gambar limit 1").catch(() => []);
  return {
    info: {
      name: text(s.nama_instansi),
      address: text(s.alamat_instansi),
      city: text(s.kabupaten),
      province: text(s.propinsi),
      contact: text(s.kontak),
      email: text(s.email),
    },
    logo: s.logo instanceof Uint8Array && s.logo.length ? s.logo : null,
    bpjsLogo: g?.bpjs instanceof Uint8Array && g.bpjs.length ? g.bpjs : null,
  };
}
