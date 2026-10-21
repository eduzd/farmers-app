/** Bangladesh divisions with Bangla names, used by the market filter and the checkout address form. */
export const DIVISIONS = [
  { id: "Dhaka", bn: "ঢাকা" },
  { id: "Chattogram", bn: "চট্টগ্রাম" },
  { id: "Rajshahi", bn: "রাজশাহী" },
  { id: "Khulna", bn: "খুলনা" },
  { id: "Barishal", bn: "বরিশাল" },
  { id: "Sylhet", bn: "সিলেট" },
  { id: "Rangpur", bn: "রংপুর" },
  { id: "Mymensingh", bn: "ময়মনসিংহ" },
];

/** A few districts per division so a location string can be matched to its division. */
const DISTRICTS: Record<string, string[]> = {
  Dhaka: ["dhaka", "ঢাকা", "gazipur", "গাজীপুর", "narayanganj", "নারায়ণগঞ্জ", "tangail", "টাঙ্গাইল", "faridpur", "ফরিদপুর", "manikganj", "মানিকগঞ্জ", "narsingdi", "নরসিংদী", "savar", "সাভার"],
  Chattogram: ["chattogram", "chittagong", "চট্টগ্রাম", "cox", "কক্সবাজার", "cumilla", "comilla", "কুমিল্লা", "noakhali", "নোয়াখালী", "feni", "ফেনী", "chandpur", "চাঁদপুর"],
  Rajshahi: ["rajshahi", "রাজশাহী", "bogura", "bogra", "বগুড়া", "pabna", "পাবনা", "naogaon", "নওগাঁ", "natore", "নাটোর", "sirajganj", "সিরাজগঞ্জ", "chapai", "চাঁপাই"],
  Khulna: ["khulna", "খুলনা", "jessore", "jashore", "যশোর", "satkhira", "সাতক্ষীরা", "bagerhat", "বাগেরহাট", "kushtia", "কুষ্টিয়া", "jhenaidah", "ঝিনাইদহ"],
  Barishal: ["barishal", "barisal", "বরিশাল", "bhola", "ভোলা", "patuakhali", "পটুয়াখালী", "pirojpur", "পিরোজপুর"],
  Sylhet: ["sylhet", "সিলেট", "moulvibazar", "মৌলভীবাজার", "habiganj", "হবিগঞ্জ", "sunamganj", "সুনামগঞ্জ", "srimangal", "শ্রীমঙ্গল"],
  Rangpur: ["rangpur", "রংপুর", "dinajpur", "দিনাজপুর", "thakurgaon", "ঠাকুরগাঁও", "kurigram", "কুড়িগ্রাম", "gaibandha", "গাইবান্ধা", "nilphamari", "নীলফামারী"],
  Mymensingh: ["mymensingh", "ময়মনসিংহ", "jamalpur", "জামালপুর", "netrokona", "নেত্রকোনা", "sherpur", "শেরপুর"],
};

/** Division for a free-text location ("Bogura, Rajshahi", "সাভার, ঢাকা"), or null. */
export function divisionOf(location?: string | null): string | null {
  const s = String(location || "").toLowerCase();
  if (!s) return null;
  for (const [div, keys] of Object.entries(DISTRICTS)) if (keys.some((k) => s.includes(k))) return div;
  return null;
}

export function divisionLabel(id: string, bn: boolean) {
  const d = DIVISIONS.find((x) => x.id === id);
  return d ? (bn ? d.bn : d.id) : id;
}
