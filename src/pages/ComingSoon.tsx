import { Card, CardContent } from "@/components/ui/card";

export default function ComingSoon({ title, emoji }: { title: string; emoji: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card><CardContent className="py-16 text-center">
        <div className="text-6xl mb-4">{emoji}</div>
        <h2 className="text-lg font-semibold mb-2">Coming soon</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          This module is part of FinTask v1 and will be rolled out in the next iteration. Your data is already being tracked and ready when this view goes live.
        </p>
      </CardContent></Card>
    </div>
  );
}
