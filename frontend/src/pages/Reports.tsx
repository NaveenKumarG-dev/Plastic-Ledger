import { FileText, Download, Share2, FileSpreadsheet, FileType2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reports } from "@/lib/mock-data";
import { toast } from "sonner";

const typeColor: Record<string, string> = {
  Detection: "bg-primary/20 text-primary",
  Attribution: "bg-cyan-500/20 text-cyan-400",
  Impact: "bg-emerald-500/20 text-emerald-400",
  Analysis: "bg-purple-500/20 text-purple-400",
};

export default function Reports() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-secondary">Reports</div>
          <h1 className="text-3xl sm:text-4xl font-bold">Evidence-grade documentation</h1>
          <p className="text-sm text-muted-foreground mt-1">Every detection is fully citable and exportable.</p>
        </div>
        <Button variant="outline" className="border-white/10 bg-white/5">
          <Filter className="mr-2 h-4 w-4" />Filter
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <div key={r.title} className="glass rounded-2xl p-5 hover:-translate-y-0.5 transition group">
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md group-hover:scale-110 transition">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <Badge className={`${typeColor[r.type] || "bg-primary/20 text-primary"} border-0 text-[10px]`}>{r.type}</Badge>
            </div>
            <h3 className="mt-4 font-semibold">{r.title}</h3>
            <div className="mt-1 text-xs text-muted-foreground">{r.date} · {r.pages} pages · {r.size}</div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={() => toast.success("PDF export started")} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0">
                <FileType2 className="mr-1.5 h-3.5 w-3.5" />PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.success("CSV export started")} className="flex-1 border-white/10 bg-white/5">
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />CSV
              </Button>
              <Button size="icon" variant="outline" onClick={() => toast("Share link copied")} className="border-white/10 bg-white/5">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 glass rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Recent exports</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-white/10">
                <th className="text-left py-2 font-medium">Report</th>
                <th className="text-left py-2 font-medium">Format</th>
                <th className="text-left py-2 font-medium">Downloaded</th>
                <th className="text-right py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 4).map((r, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-3">{r.title}</td>
                  <td className="py-3 text-muted-foreground">{i % 2 ? "CSV" : "PDF"}</td>
                  <td className="py-3 text-muted-foreground">{r.date}</td>
                  <td className="py-3 text-right">
                    <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
