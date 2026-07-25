import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Columns3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * قائمة لإظهار/إخفاء أعمدة الجدول.
 * columns: [{ key, label }]، hiddenCols: { [key]: true }، onToggle(key)
 */
export function ColumnVisibilityToggle({ columns, hiddenCols, onToggle }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
          <Columns3 className="w-3.5 h-3.5" />
          الأعمدة
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <div className="text-xs font-medium text-gray-500 px-2 py-1.5 border-b mb-1">
          إظهار / إخفاء الأعمدة
        </div>
        {columns.map((col) => (
          <label
            key={col.key}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm"
          >
            <Checkbox checked={!hiddenCols[col.key]} onCheckedChange={() => onToggle(col.key)} />
            <span>{col.label}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}