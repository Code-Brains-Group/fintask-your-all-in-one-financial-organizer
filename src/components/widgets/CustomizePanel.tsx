import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Settings2, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { WidgetState } from "@/hooks/useLayout";

type Props = {
  widgets: WidgetState[];
  labels: Record<string, { title: string; description?: string }>;
  onReorder: (from: number, to: number) => void;
  onToggle: (id: string) => void;
  onReset: () => void;
};

export default function CustomizePanel({ widgets, labels, onReorder, onToggle, onReset }: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-1" /> Customize</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Customize this page</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground mt-2">
          Show, hide, and reorder the cards below. Your layout syncs across your devices.
        </p>
        <div className="mt-4 space-y-2">
          {widgets.map((w, i) => {
            const meta = labels[w.type] || { title: w.type };
            return (
              <div key={w.id} className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                <div className="flex flex-col gap-1">
                  <button className="disabled:opacity-30" disabled={i === 0} onClick={() => onReorder(i, i - 1)}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button className="disabled:opacity-30" disabled={i === widgets.length - 1} onClick={() => onReorder(i, i + 1)}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{meta.title}</div>
                  {meta.description && <div className="text-xs text-muted-foreground truncate">{meta.description}</div>}
                </div>
                <Switch checked={w.visible} onCheckedChange={() => onToggle(w.id)} />
              </div>
            );
          })}
        </div>
        <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset to default layout
        </Button>
      </SheetContent>
    </Sheet>
  );
}
