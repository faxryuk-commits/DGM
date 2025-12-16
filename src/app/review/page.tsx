"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// =============================================
// REVIEW PAGE
// Active commitments only (from spec)
// =============================================

interface Commitment {
  id: string;
  type: string;
  scheduledAt: string | null;
  duration: number | null;
  status: string;
  createdAt: string;
  request: {
    rawText: string;
    parsedData: string;
  };
}

export default function ReviewPage() {
  const router = useRouter();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommitments = async () => {
      const userId = localStorage.getItem("userId");
      if (!userId) {
        router.push("/onboarding");
        return;
      }

      try {
        const res = await fetch(`/api/commitment?userId=${userId}`);
        const data = await res.json();
        setCommitments(data.commitments || []);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCommitments();
  }, [router]);

  const handleStatusChange = async (commitmentId: string, status: string) => {
    try {
      await fetch("/api/commitment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitmentId, status }),
      });
      
      setCommitments((prev) =>
        prev.map((c) => (c.id === commitmentId ? { ...c, status } : c))
      );
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      money: "Деньги",
      time: "Время",
      attention: "Внимание",
      "work-change": "Работа",
      support: "Поддержка",
      intro: "Знакомство",
      errand: "Поручение",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Ожидает</Badge>;
      case "confirmed":
        return <Badge variant="default">Подтверждено</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Выполнено</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Отменено</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const activeCommitments = commitments.filter((c) =>
    ["pending", "confirmed"].includes(c.status)
  );
  
  const completedCommitments = commitments.filter((c) =>
    ["completed", "cancelled"].includes(c.status)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Обязательства</h1>
          <Link href="/">
            <Button variant="ghost" size="sm">
              ← Назад
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Active Commitments */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Активные ({activeCommitments.length})
          </h2>
          
          {activeCommitments.length > 0 ? (
            <div className="space-y-4">
              {activeCommitments.map((commitment) => {
                const parsedData = JSON.parse(commitment.request.parsedData);
                return (
                  <Card key={commitment.id} className="border-border/50 shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {getTypeLabel(commitment.type)}
                          </Badge>
                          {getStatusBadge(commitment.status)}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(commitment.createdAt).toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {commitment.request.rawText}
                      </p>
                      
                      {commitment.scheduledAt && (
                        <div className="p-3 bg-accent/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Запланировано:</p>
                          <p className="font-medium">
                            {new Date(commitment.scheduledAt).toLocaleDateString("ru-RU", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {commitment.duration && (
                            <p className="text-sm text-muted-foreground">
                              {commitment.duration} мин
                            </p>
                          )}
                        </div>
                      )}
                      
                      {parsedData.params?.amount && (
                        <div className="p-3 bg-accent/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Сумма:</p>
                          <p className="font-medium">{parsedData.params.amount.toLocaleString()} ₽</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(commitment.id, "completed")}
                        >
                          Выполнено
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(commitment.id, "cancelled")}
                        >
                          Отменить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <CardDescription className="text-base">
                  Нет активных обязательств
                </CardDescription>
                <Link href="/">
                  <Button variant="outline" className="mt-4">
                    Обработать запрос
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Completed Commitments */}
        {completedCommitments.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
              Завершённые ({completedCommitments.length})
            </h2>
            <div className="space-y-3 opacity-70">
              {completedCommitments.slice(0, 5).map((commitment) => (
                <Card key={commitment.id} className="border-border/30">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="opacity-60">
                          {getTypeLabel(commitment.type)}
                        </Badge>
                        {getStatusBadge(commitment.status)}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(commitment.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                      {commitment.request.rawText}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

