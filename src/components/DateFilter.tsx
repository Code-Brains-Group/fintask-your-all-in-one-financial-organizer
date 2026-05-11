import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateShortcut, rangeFor, DateRange } from "@/lib/dateFilters";

export function DateFilter({ value, onChange, fiscal }: { value: { shortcut: DateShortcut; range: DateRange; custom?: { from?: Date; to?: Date } }; onChange: (v: any) => void; fiscal?: { monthStartDay?: number; yearStartMonth?: number } }) {
  const set = (shortcut: DateShortcut, custom?: { from?: Date; to?: Date }) => {
    onChange({ shortcut, range: rangeFor(shortcut, custom, fiscal), custom });
  };
  const shortcuts: { key: DateShortcut; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "year", label: "This year" },
  ];
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shortcuts.map(s => (
        <Button key={s.key} size="sm" variant={value.shortcut === s.key ? "default" : "outline"} onClick={() => set(s.key)}>{s.label}</Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant={value.shortcut === "custom" ? "default" : "outline"}>
            <CalendarIcon className="h-3.5 w-3.5 mr-1" />
            {value.shortcut === "custom" && value.custom?.from && value.custom?.to
              ? `${format(value.custom.from, "dd MMM")} – ${format(value.custom.to, "dd MMM")}`
              : "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={value.custom as any}
            onSelect={(r: any) => { if (r?.from && r?.to) { set("custom", r); setOpen(false); } else { onChange({ ...value, custom: r }); } }}
            numberOfMonths={1}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
