import "server-only";
import bwipjs from "bwip-js/node";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";

/**
 * The three letters, laid out as SIMRS Khanza prints them. Each is a list of
 * things to draw at positions taken from Khanza's own report files
 * (rptBridgingSuratKontrol2, rptSuratSakit5, rptSuratKeteranganSehat), and the
 * same list is drawn twice: as SVG for the phone's screen, and as a PDF to
 * download. So what a patient sees is what they get on paper.
 */

export type LetterType = "kontrol" | "sakit" | "sehat" | "kematian";
export type Letter = { type: LetterType; noSurat: string; data: Record<string, string> };
export type Hospital = {
  name: string;
  address: string;
  city: string;
  province: string;
  contact: string;
  email: string;
  logoUrl: string | null;
  bpjsLogoUrl: string | null;
};

export const TITLES: Record<LetterType, string> = {
  kontrol: "Surat Rencana Kontrol",
  sakit: "Surat Keterangan Sakit",
  sehat: "Surat Keterangan Sehat",
  kematian: "Surat Kematian",
};

/** The file name a letter is saved under, safe on every phone ("Surat Keterangan Sakit 2026-SKS-0012.pdf"). */
export function pdfName(type: LetterType, noSurat: string) {
  return `${TITLES[type]} ${noSurat}`.replace(/[^A-Za-z0-9 ._-]/g, "-") + ".pdf";
}

type Align = "left" | "center" | "right";
type Op =
  | { k: "text"; x: number; y: number; text: string; size: number; bold: boolean; width: number; underline: boolean }
  | { k: "line"; x: number; y: number; w: number }
  | { k: "image"; x: number; y: number; w: number; h: number; src: "logo" | "bpjs" }
  | { k: "code"; x: number; y: number; w: number; h: number; png: string };
type Sheet = { width: number; height: number; ops: Op[] };

type Fonts = { regular: PDFFont; bold: PDFFont };
let fontsOnce: Promise<Fonts> | undefined;
/** Helvetica's measurements, for wrapping and centring text the same way on screen and in the PDF. */
function metrics() {
  fontsOnce ??= (async () => {
    const doc = await PDFDocument.create();
    return { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  })();
  return fontsOnce;
}

/** The standard PDF fonts only know Latin-1; anything else in a name becomes "?". */
const latin = (value: string) => value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-12-02" as Khanza's reports print it: "2 December 2026". */
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso;
};

async function code(bcid: "qrcode" | "code128", text: string) {
  // `eclevel` is a QR option bwip-js accepts but doesn't list in its types.
  const options = bcid === "qrcode" ? { bcid, text, scale: 4, eclevel: "H" } : { bcid, text, scale: 3, height: 14, includetext: false };
  const png = await bwipjs.toBuffer(options as Parameters<typeof bwipjs.toBuffer>[0]);
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

/** `spacing` is the line height as a multiple of the size (Jasper's "1_1_2" is 1.5). */
type TextOptions = { size?: number; bold?: boolean; align?: Align; middle?: boolean; underline?: boolean; wrap?: boolean; spacing?: number };

/** A sheet being drawn on, in the report file's own coordinates (inside the page margins). */
function sheet(width: number, height: number, margin: { left: number; top: number }, fonts: Fonts) {
  const ops: Op[] = [];
  const at = (x: number, y: number) => ({ x: x + margin.left, y: y + margin.top });
  return {
    width,
    height,
    ops,
    /** Text in a box, as a report's text field: top-left by default, wrapped when asked. */
    text(x: number, y: number, w: number, h: number, value: string, options: TextOptions = {}) {
      const { size = 11, bold = false, align = "left", middle = false, underline = false, wrap = false, spacing = 1.2 } = options;
      const font = bold ? fonts.bold : fonts.regular;
      const measure = (s: string) => font.widthOfTextAtSize(s, size);
      const lines: string[] = [];
      const clean = latin(value);
      if (!wrap || measure(clean) <= w) lines.push(clean);
      else {
        let line = "";
        for (const word of clean.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (line && measure(next) > w) {
            lines.push(line);
            line = word;
          } else line = next;
        }
        if (line) lines.push(line);
      }
      const leading = size * spacing;
      const top = middle ? y + Math.max(0, (h - leading) / 2) : y;
      lines.forEach((line, i) => {
        const width = measure(line);
        const left = align === "center" ? x + (w - width) / 2 : align === "right" ? x + w - width : x;
        const p = at(left, top + size * 0.95 + i * leading);
        ops.push({ k: "text", x: p.x, y: p.y, text: line, size, bold, width, underline });
      });
    },
    line(x: number, y: number, w: number) {
      ops.push({ k: "line", ...at(x, y), w });
    },
    image(x: number, y: number, w: number, h: number, src: "logo" | "bpjs") {
      ops.push({ k: "image", ...at(x, y), w, h, src });
    },
    /** A QR code, square and centred in its box as the report draws it. */
    async qr(x: number, y: number, w: number, h: number, value: string) {
      const side = Math.min(w, h);
      ops.push({ k: "code", ...at(x + (w - side) / 2, y + (h - side) / 2), w: side, h: side, png: await code("qrcode", value) });
    },
    async barcode(x: number, y: number, w: number, h: number, value: string) {
      ops.push({ k: "code", ...at(x, y), w, h, png: await code("code128", value) });
    },
  };
}

async function kontrol(d: Record<string, string>, hospital: Hospital, fonts: Fonts, printedAt: string): Promise<Sheet> {
  const s = sheet(595, 390, { left: 42, top: 20 }, fonts);
  const label = { size: 10, middle: true };
  s.image(0, 33, 141, 38, "bpjs");
  s.text(145, 36, 222, 18, "SURAT RENCANA KONTROL", { size: 12, middle: true });
  s.text(145, 52, 222, 17, hospital.name, { size: 11 });
  s.text(380, 36, 150, 17, `No. ${d.noSurat}`, { size: 11 });
  s.text(380, 52, 21, 17, "Tgl.", { size: 11 });
  s.text(401, 52, 128, 17, longDate(d.tglRencana), { size: 11 });
  s.text(0, 90, 75, 13, "Kepada Yth", label);
  s.text(75, 90, 250, 13, d.dokter, { size: 10 });
  s.text(75, 104, 250, 13, d.poli, { size: 10 });
  await s.barcode(367, 91, 163, 43, d.noSurat);
  s.text(0, 120, 325, 13, "Mohon Pemeriksaan dan Penanganan Lebih Lanjut :", label);
  const rows: [string, string][] = [
    ["No. Kartu", d.noKartu],
    ["Nama Pasien", `${d.nama} ( ${d.jk === "P" ? "PEREMPUAN" : d.jk === "L" ? "LAKI-LAKI" : d.jk} )`],
    ["Tgl. Lahir", longDate(d.tglLahir)],
    ["Diagnosa Awal", d.diagnosa],
    ["Tgl. Entri", longDate(d.tglSurat)],
  ];
  rows.forEach(([name, value], i) => {
    const y = 134 + i * 14;
    s.text(0, y, 67, 13, name, label);
    s.text(68, y, 7, 13, ":", label);
    s.text(75, y, 289, 13, value, { size: 10 });
  });
  s.text(0, 207, 360, 13, "Demikian atas bantuannya diucapkan banyak terima kasih", label);
  s.text(373, 180, 105, 13, "Mengetahui", { size: 10, align: "center", middle: true });
  await s.qr(364, 197, 126, 59, d.finger);
  s.line(373, 262, 105);
  s.text(0, 251, 40, 11, "Tgl. Cetak", { size: 7, middle: true });
  s.text(38, 251, 216, 11, printedAt, { size: 7, middle: true });
  return s;
}

async function sakit(d: Record<string, string>, hospital: Hospital, fonts: Fonts): Promise<Sheet> {
  const s = sheet(595, 842, { left: 20, top: 20 }, fonts);
  s.image(0, 0, 70, 70, "logo");
  s.text(72, 4, 482, 17, hospital.name, { size: 14, bold: true });
  s.text(74, 23, 480, 14, hospital.address, { size: 8 });
  s.text(74, 39, 480, 12, `${hospital.city}, ${hospital.province}`, { size: 8 });
  s.text(72, 53, 482, 17, hospital.contact, { size: 10 });
  s.line(0, 73, 552);
  s.text(0, 75, 554, 14, "SURAT KETERANGAN SAKIT", { bold: true, underline: true, align: "center" });
  s.text(198, 91, 155, 14, `No. ${d.noSurat}`, { align: "center" });
  s.text(0, 111, 554, 14, "Yang bertanda tangan dibawah ini menerangkan bahwa:");
  const rows: [string, string][] = [
    ["Nama Pasien", d.nama],
    ["Umur", d.umur],
    ["Jenis Kelamin", d.jk === "L" ? "Laki-Laki" : "Perempuan"],
    ["Pekerjaan", d.pekerjaan],
    ["Instansi", d.instansi],
    ["Alamat", d.alamat],
  ];
  rows.forEach(([name, value], i) => {
    const y = 127 + i * 16;
    s.text(0, y, 79, 14, name);
    s.text(80, y, 7, 14, ":");
    s.text(91, y, 463, 14, value);
  });
  s.text(0, 223, 79, 14, "Keterangan");
  s.text(80, 223, 7, 14, ":");
  s.text(91, 223, 159, 14, "Memerlukan istirahat selama");
  s.text(252, 223, 60, 14, d.hari);
  s.text(314, 223, 27, 14, "hari");
  s.text(343, 223, 188, 14, "karena sakit terhitung dari tanggal");
  s.text(91, 239, 68, 14, d.tanggalAwal);
  s.text(160, 239, 87, 14, "sampai dengan", { align: "center" });
  s.text(249, 239, 104, 14, d.tanggalAkhir);
  s.text(0, 255, 79, 14, "Diagnosa");
  s.text(80, 255, 7, 14, ":");
  s.text(91, 255, 463, 14, d.penyakit);
  s.text(0, 271, 554, 14, "Demikian agar yang berkepentingan harap maklum.");
  const centre = { align: "center" as const };
  s.text(0, 307, 230, 14, "Saya memberi ijin kepada", centre);
  s.text(0, 323, 230, 14, hospital.name, centre);
  s.text(0, 339, 229, 14, "untuk memberikan keterangan", centre);
  s.text(0, 355, 230, 14, "diagnosa kepada pihak yang berkepentingan", centre);
  s.text(0, 371, 230, 14, "berkepentingan", centre);
  s.text(1, 425, 228, 14, d.nama, centre);
  s.text(373, 306, 177, 14, `${hospital.city}, ${d.tglRegistrasi}`, centre);
  s.text(373, 321, 177, 14, "Pemeriksa", centre);
  await s.qr(373, 340, 174, 73, d.finger);
  s.text(373, 419, 177, 14, d.dokter, centre);
  return s;
}

async function sehat(d: Record<string, string>, hospital: Hospital, fonts: Fonts): Promise<Sheet> {
  const s = sheet(595, 845, { left: 20, top: 20 }, fonts);
  const centre = { align: "center" as const };
  const small = { size: 9 };
  const body = { size: 12 };
  s.image(3, 0, 48, 45, "logo");
  s.text(52, 0, 499, 17, hospital.name, { size: 12, ...centre });
  s.text(52, 14, 499, 14, `${hospital.address}, ${hospital.city}, ${hospital.province}`, { size: 9, ...centre });
  s.text(52, 25, 499, 14, hospital.contact, { size: 9, ...centre });
  s.text(52, 36, 499, 15, `e-mail: ${hospital.email}`, { size: 9, ...centre });
  s.line(2, 48, 550);
  s.text(2, 53, 551, 21, "SURAT KETERANGAN SEHAT", { size: 12, bold: true, underline: true, ...centre });
  s.text(194, 73, 83, 23, "No. Surat", body);
  s.text(251, 75, 7, 12, ":", small);
  s.text(259, 72, 294, 18, d.noSurat, body);
  s.text(5, 96, 546, 30, `Yang bertandatangan di bawah ini, ${d.dokter} dengan mengingat sumpah waktu menerima jabatan bahwa :`, { ...body, wrap: true });
  s.text(5, 123, 83, 23, "Nama", body);
  s.text(88, 126, 7, 12, ":", small);
  s.text(96, 124, 455, 18, d.nama, body);
  s.text(6, 137, 83, 23, "Umur", body);
  s.text(88, 140, 7, 12, ":", small);
  s.text(96, 138, 150, 24, d.umur, body);
  s.text(5, 152, 83, 16, "Jenis Kelamin", body);
  s.text(88, 155, 7, 12, ":", small);
  s.text(96, 152, 455, 15, d.jk === "L" ? "Laki-Laki" : "Perempuan", body);
  s.text(5, 165, 83, 22, "Alamat", body);
  s.text(88, 168, 9, 12, ":", small);
  s.text(96, 167, 455, 34, d.alamat, { ...body, wrap: true });
  s.text(5, 201, 83, 22, "Berat badan", body);
  s.text(87, 204, 7, 12, ":", small);
  s.text(96, 202, 24, 20, d.berat, body);
  s.text(121, 202, 21, 22, "kg", body);
  s.text(197, 203, 74, 22, "Tinggi badan", body);
  s.text(270, 205, 7, 12, ":", small);
  s.text(276, 204, 24, 24, d.tinggi, body);
  s.text(302, 203, 48, 22, "cm", body);
  s.text(369, 203, 41, 22, "Suhu", body);
  s.text(411, 205, 7, 12, ":", small);
  s.text(419, 203, 31, 24, d.suhu, body);
  s.text(447, 203, 14, 22, "C", body);
  s.text(5, 216, 83, 22, "Tekanan darah", body);
  s.text(87, 218, 7, 12, ":", small);
  s.text(96, 217, 56, 24, d.tensi, body);
  s.text(152, 217, 45, 22, "mmHg", body);
  s.text(198, 218, 73, 22, "Buta warna", body);
  s.text(270, 220, 7, 12, ":", small);
  s.text(276, 219, 100, 19, d.butaWarna, body);
  s.text(
    4,
    235,
    551,
    30,
    "Pada hari ini telah kami periksa dengan teliti kesehatannya dan berpendapat bahwa kesehatan saudara tersebut pada waktu diperiksa :",
    { ...body, wrap: true },
  );
  s.text(6, 260, 545, 21, d.kesimpulan, { size: 14, bold: true, ...centre });
  s.text(4, 281, 550, 31, "Demikian surat keterangan ini dibuat dengan sebenar-benarnya untuk dapat digunakan sesuai keperluan.", { ...body, wrap: true });
  s.text(360, 303, 193, 23, `${hospital.city}, ${d.tanggalSurat}`, { ...body, ...centre });
  s.text(4, 331, 63, 22, "Keperluan :", body);
  s.text(66, 331, 274, 59, d.keperluan, { ...body, wrap: true });
  await s.qr(363, 320, 188, 60, d.finger);
  s.text(360, 380, 192, 19, d.dokter, { ...body, ...centre });
  return s;
}

async function kematian(d: Record<string, string>, hospital: Hospital, fonts: Fonts): Promise<Sheet> {
  const s = sheet(595, 842, { left: 20, top: 20 }, fonts);
  const centre = { align: "center" as const };
  s.image(1, 1, 51, 51, "logo");
  s.text(1, 1, 548, 15, hospital.name, { size: 12, ...centre });
  s.text(1, 16, 548, 10, `${hospital.address}, ${hospital.city}`, { size: 8, ...centre });
  s.text(1, 25, 548, 10, hospital.contact, { size: 8, ...centre });
  s.text(1, 34, 548, 10, `Email : ${hospital.email}`, { size: 8, ...centre });
  s.text(1, 43, 548, 10, hospital.province, { size: 8, ...centre });
  s.line(0, 55, 549);
  s.text(0, 72, 549, 27, "SURAT KEMATIAN", { size: 12, middle: true, ...centre });
  s.text(0, 109, 52, 14, "Nomor");
  s.text(52, 109, 3, 14, ":");
  s.text(60, 109, 140, 14, d.noSurat);
  s.line(60, 124, 140);
  s.text(0, 130, 52, 14, "Lamp.");
  s.text(52, 130, 3, 14, ":");
  s.line(60, 144, 140);
  // The report's box cuts off the rest of this line ("bahwa :"), so the printout ends here.
  s.text(0, 168, 257, 14, "Yang bertanda tangan di bawah ini menerangkan");
  // The report's age box is only wide enough for the years of "40 Th 3 Bl 12 Hr".
  const years = /^\s*\d+\s*Th/i.exec(d.umur)?.[0] ?? d.umur;
  const rows: [string, number][] = [
    ["Nama", 197],
    ["Umur", 218],
    ["Alamat", 239],
  ];
  for (const [name, y] of rows) {
    s.text(40, y, 53, 14, name);
    s.text(93, y, 3, 14, ":");
    s.line(103, y + 15, 444);
  }
  s.text(103, 197, 444, 14, d.nama);
  s.text(103, 218, 40, 14, years);
  s.text(143, 218, 25, 14, "th. (");
  s.text(168, 218, 37, 14, d.jk, centre);
  s.text(205, 218, 15, 14, ")");
  s.text(103, 239, 444, 14, d.alamat);
  s.text(
    0,
    271,
    549,
    89,
    `Telah meninggal dunia pada tanggal ${d.tanggal} jam ${d.jam} di ${hospital.name} dikarenakan ${d.keterangan}. Demikian surat keterangan ini dibuat agar menjadikan maklum dan dapat dipergunakan sebagaimana mestinya`,
    { wrap: true, spacing: 1.5 * 1.2 },
  );
  s.text(350, 374, 199, 14, `${hospital.city}, ${d.tanggal}`, centre);
  s.text(350, 393, 199, 14, "Dokter Pemeriksa", centre);
  await s.qr(350, 409, 199, 59, d.finger);
  s.text(350, 468, 199, 14, d.dokter, centre);
  s.line(350, 482, 199);
  return s;
}

/** "13/11/2026 10:32:23 AM", in the hospital's time zone. */
function printedNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: process.env.HOSPITAL_TIME_ZONE || "Asia/Makassar",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")} ${get("dayPeriod").toUpperCase()}`;
}

async function layout(letter: Letter, hospital: Hospital): Promise<Sheet> {
  const fonts = await metrics();
  if (letter.type === "kontrol") return kontrol(letter.data, hospital, fonts, printedNow());
  if (letter.type === "sakit") return sakit(letter.data, hospital, fonts);
  if (letter.type === "kematian") return kematian(letter.data, hospital, fonts);
  return sehat(letter.data, hospital, fonts);
}

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (value: number) => Math.round(value * 100) / 100;

/** The letter as an SVG picture of the paper, trimmed below the last line so a phone needn't scroll through blank page. */
export async function letterSvg(letter: Letter, hospital: Hospital) {
  const page = await layout(letter, hospital);
  const bottom = Math.max(...page.ops.map((op) => (op.k === "text" ? op.y : op.k === "line" ? op.y : op.y + op.h)));
  const height = Math.min(page.height, Math.ceil(bottom + 32));
  const parts = page.ops.map((op) => {
    if (op.k === "text") {
      const weight = op.bold ? ' font-weight="700"' : "";
      // textLength pins each line to Helvetica's width, whatever sans-serif the phone has.
      const fit = op.text.length > 1 ? ` textLength="${n(op.width)}" lengthAdjust="spacingAndGlyphs"` : "";
      const under = op.underline ? `<rect x="${n(op.x)}" y="${n(op.y + 1.5)}" width="${n(op.width)}" height="0.8"/>` : "";
      return `<text x="${n(op.x)}" y="${n(op.y)}" font-size="${op.size}"${weight}${fit}>${esc(op.text)}</text>${under}`;
    }
    if (op.k === "line") return `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="1"/>`;
    const href = op.k === "code" ? op.png : op.src === "logo" ? hospital.logoUrl : hospital.bpjsLogoUrl;
    if (!href) return "";
    return `<image x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" preserveAspectRatio="none" href="${esc(href)}"/>`;
  });
  return {
    width: page.width,
    height,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${height}" role="img" aria-label="${esc(`${TITLES[letter.type]} ${letter.noSurat}`)}" ` +
      `font-family="Helvetica, Arial, 'Liberation Sans', sans-serif" fill="#000" style="display:block;width:100%;height:auto;background:#fff">` +
      parts.join("") +
      "</svg>",
  };
}

const images = new Map<string, Promise<Uint8Array>>();
/** A logo's bytes, fetched once per server instance. */
function bytesOf(url: string) {
  let found = images.get(url);
  if (!found) {
    found = fetch(url).then(async (response) => {
      if (!response.ok) throw Error(`Logo not available (${response.status})`);
      return new Uint8Array(await response.arrayBuffer());
    });
    found.catch(() => images.delete(url));
    images.set(url, found);
  }
  return found;
}

const embed = (doc: PDFDocument, bytes: Uint8Array) => (bytes[0] === 0x89 ? doc.embedPng(bytes) : doc.embedJpg(bytes));

/** The same letter as a PDF on its full page. */
export async function letterPdf(letter: Letter, hospital: Hospital) {
  const page = await layout(letter, hospital);
  const doc = await PDFDocument.create();
  doc.setTitle(`${TITLES[letter.type]} ${letter.noSurat}`);
  doc.setAuthor(hospital.name);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const paper = doc.addPage([page.width, page.height]);
  const black = rgb(0, 0, 0);
  const fromTop = (y: number) => page.height - y;
  for (const op of page.ops) {
    if (op.k === "text") {
      paper.drawText(op.text, { x: op.x, y: fromTop(op.y), size: op.size, font: op.bold ? bold : regular, color: black });
      if (op.underline) paper.drawRectangle({ x: op.x, y: fromTop(op.y + 2.3), width: op.width, height: 0.8, color: black });
    } else if (op.k === "line") paper.drawRectangle({ x: op.x, y: fromTop(op.y + 1), width: op.w, height: 1, color: black });
    else {
      let image: PDFImage | null = null;
      if (op.k === "code") image = await doc.embedPng(op.png);
      else {
        const url = op.src === "logo" ? hospital.logoUrl : hospital.bpjsLogoUrl;
        // A letter without its logo is still the letter.
        if (url) image = await bytesOf(url).then((bytes) => embed(doc, bytes)).catch(() => null);
      }
      if (image) paper.drawImage(image, { x: op.x, y: fromTop(op.y + op.h), width: op.w, height: op.h });
    }
  }
  return await doc.save();
}
