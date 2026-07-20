export const stats = {
  totalClusters: 12847,
  accuracy: 94.2,
  regions: 38,
  highRisk: 127,
};

export const polymers = [
  { name: "PET", full: "Polyethylene Terephthalate", confidence: 96, density: 1.38, melt: 260, use: "Bottles, packaging" },
  { name: "HDPE", full: "High-Density Polyethylene", confidence: 91, density: 0.95, melt: 130, use: "Containers, pipes" },
  { name: "LDPE", full: "Low-Density Polyethylene", confidence: 87, density: 0.92, melt: 110, use: "Bags, films" },
  { name: "PVC", full: "Polyvinyl Chloride", confidence: 82, density: 1.4, melt: 100, use: "Pipes, cables" },
  { name: "PP", full: "Polypropylene", confidence: 78, density: 0.91, melt: 160, use: "Caps, textiles" },
];

export const sources = [
  { name: "Rayon Textile Factory A", country: "Indonesia", confidence: 96 },
  { name: "Petrochem Industries B", country: "India", confidence: 88 },
  { name: "PackWorld Manufacturing C", country: "Vietnam", confidence: 76 },
  { name: "Marine Fisheries Coop D", country: "Philippines", confidence: 64 },
];

export const monthlyTrend = [
  { m: "Jan", detected: 620, cleaned: 210 },
  { m: "Feb", detected: 740, cleaned: 260 },
  { m: "Mar", detected: 810, cleaned: 340 },
  { m: "Apr", detected: 690, cleaned: 380 },
  { m: "May", detected: 920, cleaned: 420 },
  { m: "Jun", detected: 1040, cleaned: 510 },
  { m: "Jul", detected: 1180, cleaned: 620 },
  { m: "Aug", detected: 1020, cleaned: 680 },
  { m: "Sep", detected: 970, cleaned: 700 },
  { m: "Oct", detected: 880, cleaned: 720 },
];

export const polymerDist = [
  { name: "PET", value: 34 },
  { name: "HDPE", value: 22 },
  { name: "LDPE", value: 17 },
  { name: "PVC", value: 14 },
  { name: "PP", value: 13 },
];

export const oceanRegions = [
  { region: "Pacific", pollution: 82 },
  { region: "Atlantic", pollution: 61 },
  { region: "Indian", pollution: 74 },
  { region: "Arctic", pollution: 28 },
  { region: "Southern", pollution: 19 },
];

export const hotspots = [
  { id: 1, name: "Great Pacific Garbage Patch", x: 22, y: 42, level: "critical" },
  { id: 2, name: "Bay of Bengal", x: 68, y: 52, level: "high" },
  { id: 3, name: "Mediterranean Basin", x: 52, y: 34, level: "high" },
  { id: 4, name: "Gulf of Mexico", x: 28, y: 46, level: "medium" },
  { id: 5, name: "Yangtze River Delta", x: 78, y: 44, level: "critical" },
  { id: 6, name: "Niger Delta", x: 49, y: 55, level: "medium" },
  { id: 7, name: "Amazon River Mouth", x: 34, y: 60, level: "high" },
  { id: 8, name: "North Sea", x: 50, y: 24, level: "medium" },
];

export const reports = [
  { title: "Q3 Detection Report", type: "Detection", date: "Oct 2, 2026", size: "4.2 MB", pages: 42 },
  { title: "Source Attribution — Bay of Bengal", type: "Attribution", date: "Sep 28, 2026", size: "2.8 MB", pages: 28 },
  { title: "Environmental Impact Assessment", type: "Impact", date: "Sep 20, 2026", size: "6.1 MB", pages: 61 },
  { title: "Polymer Fingerprinting Study", type: "Analysis", date: "Sep 12, 2026", size: "3.4 MB", pages: 34 },
  { title: "Cleanup Effectiveness Review", type: "Impact", date: "Aug 30, 2026", size: "2.1 MB", pages: 22 },
  { title: "Monthly Monitoring Digest", type: "Detection", date: "Aug 15, 2026", size: "1.6 MB", pages: 18 },
];
