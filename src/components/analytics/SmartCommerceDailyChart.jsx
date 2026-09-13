import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card } from "@/components/ui/card";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 0 });
const money = (n) => `${fmt(n)} ج`;

export default function SmartCommerceDailyChart({ data, avg3Sales, elapsedDays }) {
  return (
    <Card className="p-4">
      <div className="mb-4">
        <h2 className="font-black text-gray-800">المسار اليومي — الفترة الحالية مقابل السابقة</h2>
        <p className="text-xs text-gray-500">المبيعات والمشتريات لكل يوم بنفس ترتيب أيام الفترة للمقارنة العادلة</p>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{top:10,right:5,left:5,bottom:5}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{fontSize:11}} />
          <YAxis tickFormatter={(v)=>fmt(v)} tick={{fontSize:10}} width={65} />
          <Tooltip
            formatter={(v,n)=>[money(v), n === "sales" ? "مبيعات الفترة الحالية" : n === "prevSales" ? "مبيعات الفترة السابقة" : n === "purchases" ? "مشتريات الفترة الحالية" : "مشتريات الفترة السابقة"]}
            labelFormatter={(d)=>`اليوم رقم ${d}`}
          />
          <Bar dataKey="sales" fill="#0d9488" radius={[4,4,0,0]} />
          <Bar dataKey="prevSales" fill="#99f6e4" radius={[4,4,0,0]} />
          <Line type="monotone" dataKey="purchases" stroke="#2563eb" strokeWidth={3} dot={{r:2}} />
          <Line type="monotone" dataKey="prevPurchases" stroke="#93c5fd" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          {avg3Sales > 0 && <ReferenceLine y={avg3Sales / Math.max(elapsedDays,1)} stroke="#f59e0b" strokeDasharray="4 4" label={{value:"متوسط مبيعات 3 دورات",fontSize:10,fill:"#b45309"}} />}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
