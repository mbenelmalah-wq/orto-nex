import { db, analysesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const PIVOT_ORDER = ["DO","RE","MI","FA","SOL","LA","SI"];

function norm(v) {
  if (!v) return null;
  return v.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function main() {
  const rows = await db.select().from(analysesTable).where(inArray(analysesTable.signal,["BUY","SELL"]));
  const cands = rows.filter((r) => r.entry && r.entry.trim());
  console.log(cands.length + " candidates sur " + rows.length);
  let u=0, s=0;
  for (const row of cands) {
    const e = norm(row.entry);
    const t1 = norm(row.tp1);
    let mismatch = false;
    let detail = "";
    if (!e) { mismatch=true; detail="Entry invalide: "+row.entry; }
    else if (!t1) { mismatch=true; detail="tp1 absent"; }
    else {
      const ei=PIVOT_ORDER.indexOf(e), t1i=PIVOT_ORDER.indexOf(t1);
      if (row.signal==="BUY" && t1i<=ei) { mismatch=true; detail="BUY: tp1 "+t1+" doit etre sup a "+e; }
      if (row.signal==="SELL" && t1i>=ei) { mismatch=true; detail="SELL: tp1 "+t1+" doit etre inf a "+e; }
    }
    if (mismatch) {
      await db.update(analysesTable).set({tp_mismatch:true,tp_mismatch_detail:detail}).where(eq(analysesTable.id,row.id));
      console.log("mismatch id="+row.id+" "+detail);
      u++;
    } else {
      await db.update(analysesTable).set({tp_mismatch:false,tp_mismatch_detail:null}).where(eq(analysesTable.id,row.id));
      s++;
    }
  }
  console.log("Done mismatches:"+u+" valides:"+s);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
