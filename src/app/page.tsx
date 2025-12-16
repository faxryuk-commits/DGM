"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ParsedRequest, EnergyLevel, DecisionResultType } from "@/lib/types";

// =============================================
// UX FLOW (from spec):
// Capture → Decision → Calendar → Response → Review
// =============================================

type FlowStep = "capture" | "decision" | "calendar" | "response";

interface CalendarSlot {
  start: string;
  end: string;
  available: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Flow state
  const [step, setStep] = useState<FlowStep>("capture");
  const [rawText, setRawText] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRequest | null>(null);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>("green");
  const [decision, setDecision] = useState<{
    result: DecisionResultType;
    reasonCodes: string[];
    templateKey: string;
    templateText: string;
    requiresCalendar: boolean;
  } | null>(null);
  const [calendarSlots, setCalendarSlots] = useState<CalendarSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Check user on mount
  useEffect(() => {
    const checkUser = async () => {
      const stored = localStorage.getItem("userId");
      if (!stored) {
        router.push("/onboarding");
        return;
      }
      
      try {
        const res = await fetch(`/api/user?id=${stored}`);
        const data = await res.json();
        
        if (!data.user?.profile) {
          router.push("/onboarding");
          return;
        }
        
        setUserId(stored);
        setHasProfile(true);
        setEnergyLevel(data.user.dynamicState?.energyLevel || "green");
        
        // Check if calendar was just connected
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('calendar_connected') === 'true') {
          // Refresh to show updated state
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch {
        router.push("/onboarding");
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  // Handle text analysis
  const handleAnalyze = async () => {
    if (!rawText.trim() || !userId) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, userId }),
      });
      
      const data = await res.json();
      setRequestId(data.requestId);
      setParsedData(data.parsedData);
      setStep("decision");
    } catch (error) {
      console.error("Parse error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle decision
  const handleDecide = async () => {
    if (!requestId) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, energyLevel }),
      });
      
      const data = await res.json();
      setDecision(data);
      setResponseText(data.templateText);
      
      if (data.result === "ALLOW" && data.requiresCalendar) {
        // Fetch calendar slots with userId
        const calRes = await fetch(`/api/calendar?duration=${parsedData?.params.duration || 60}&days=7&userId=${userId}`);
        const calData = await calRes.json();
        setCalendarSlots(calData.slots || []);
        setStep("calendar");
      } else {
        setStep("response");
      }
    } catch (error) {
      console.error("Decision error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle slot selection
  const handleSlotSelect = () => {
    setStep("response");
  };

  // Handle send/confirm
  const handleConfirm = async () => {
    if (!requestId || !decision) return;
    
    if (decision.result === "ALLOW") {
      setIsProcessing(true);
      try {
        await fetch("/api/commitment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            scheduledAt: selectedSlot?.start,
            duration: parsedData?.params.duration,
          }),
        });
      } catch (error) {
        console.error("Commitment error:", error);
      } finally {
        setIsProcessing(false);
      }
    }
    
    // Reset for new request
    handleReset();
  };

  // Reset flow
  const handleReset = () => {
    setStep("capture");
    setRawText("");
    setRequestId(null);
    setParsedData(null);
    setDecision(null);
    setCalendarSlots([]);
    setSelectedSlot(null);
    setResponseText("");
  };

  const getIntentLabel = (intent: string) => {
    const labels: Record<string, string> = {
      "money": "Деньги",
      "time": "Время",
      "attention": "Внимание",
      "work-change": "Смена работы",
      "support": "Поддержка",
      "intro": "Знакомство",
      "errand": "Поручение",
      "decision-pressure": "Давление",
      "emotional-load": "Эмоц. нагрузка",
    };
    return labels[intent] || intent;
  };

  const getActorLabel = (actor: string) => {
    const labels: Record<string, string> = {
      "family": "Семья",
      "friend": "Друг",
      "team": "Команда",
      "client": "Клиент",
      "unknown": "Неизвестный",
    };
    return labels[actor] || actor;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (!hasProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Decision OS</h1>
          <div className="flex items-center gap-4">
            <Link href="/review">
              <Button variant="ghost" size="sm">
                Обязательства
              </Button>
            </Link>
            {/* Energy indicator */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Энергия:</span>
              <div
                className={`w-3 h-3 rounded-full ${
                  energyLevel === "green"
                    ? "bg-green-500"
                    : energyLevel === "yellow"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Step: Capture */}
        {step === "capture" && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>Новый запрос</CardTitle>
              <CardDescription>
                Вставьте или напишите текст запроса, который вам поступил
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Например: 'Привет! Можешь одолжить 5000 до пятницы?' или 'Давай созвонимся на час обсудить проект?'"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <Button
                onClick={handleAnalyze}
                disabled={!rawText.trim() || isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? "Анализирую..." : "Анализировать"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Decision */}
        {step === "decision" && parsedData && (
          <div className="space-y-6">
            {/* Parsed Summary */}
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Разбор запроса</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Намерение</p>
                    <Badge variant="secondary" className="text-base">
                      {getIntentLabel(parsedData.intent)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">От кого</p>
                    <Badge variant="outline" className="text-base">
                      {getActorLabel(parsedData.actorType)}
                    </Badge>
                  </div>
                </div>
                
                {parsedData.params.amount && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Сумма</p>
                    <p className="font-semibold">{parsedData.params.amount.toLocaleString()} ₽</p>
                  </div>
                )}
                
                {parsedData.params.duration && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Длительность</p>
                    <p className="font-semibold">{parsedData.params.duration} мин</p>
                  </div>
                )}
                
                {parsedData.decisionPressure && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-destructive font-medium">⚠️ Обнаружено давление</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Energy Selector */}
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Ваш уровень энергии</CardTitle>
                <CardDescription>Выберите текущее состояние</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={energyLevel}
                  onValueChange={(v) => setEnergyLevel(v as EnergyLevel)}
                  className="flex gap-4"
                >
                  <div className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    energyLevel === "green" ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="green" id="green" />
                      <Label htmlFor="green" className="cursor-pointer">
                        <span className="font-semibold text-green-600 dark:text-green-400">Зелёный</span>
                        <p className="text-sm text-muted-foreground">Полная мощность</p>
                      </Label>
                    </div>
                  </div>
                  <div className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    energyLevel === "yellow" ? "border-yellow-500 bg-yellow-500/10" : "border-border hover:border-yellow-500/50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="yellow" id="yellow" />
                      <Label htmlFor="yellow" className="cursor-pointer">
                        <span className="font-semibold text-yellow-600 dark:text-yellow-400">Жёлтый</span>
                        <p className="text-sm text-muted-foreground">Осторожно</p>
                      </Label>
                    </div>
                  </div>
                  <div className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    energyLevel === "red" ? "border-red-500 bg-red-500/10" : "border-border hover:border-red-500/50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="red" id="red" />
                      <Label htmlFor="red" className="cursor-pointer">
                        <span className="font-semibold text-red-600 dark:text-red-400">Красный</span>
                        <p className="text-sm text-muted-foreground">Без обязательств</p>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={handleReset}>
                Отмена
              </Button>
              <Button onClick={handleDecide} disabled={isProcessing} className="flex-1">
                {isProcessing ? "Проверяю..." : "Получить решение"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Calendar */}
        {step === "calendar" && (
          <div className="space-y-6">
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Выберите слот</CardTitle>
                <CardDescription>Доступные слоты на ближайшую неделю</CardDescription>
              </CardHeader>
              <CardContent>
                {calendarSlots.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {calendarSlots.slice(0, 12).map((slot, i) => {
                      const date = new Date(slot.start);
                      const isSelected = selectedSlot?.start === slot.start;
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="font-medium">
                            {date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Нет доступных слотов
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={() => setStep("decision")}>
                Назад
              </Button>
              <Button onClick={handleSlotSelect} disabled={!selectedSlot} className="flex-1">
                Выбрать слот
              </Button>
              <Button variant="outline" onClick={() => { setSelectedSlot(null); setStep("response"); }}>
                Пропустить
              </Button>
            </div>
          </div>
        )}

        {/* Step: Response */}
        {step === "response" && decision && (
          <div className="space-y-6">
            {/* Decision Result */}
            <Card className={`border-2 shadow-lg ${
              decision.result === "ALLOW"
                ? "border-green-500/50 bg-green-500/5"
                : decision.result === "DEFER"
                ? "border-yellow-500/50 bg-yellow-500/5"
                : "border-red-500/50 bg-red-500/5"
            }`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${
                    decision.result === "ALLOW"
                      ? "bg-green-500"
                      : decision.result === "DEFER"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`} />
                  <CardTitle>
                    {decision.result === "ALLOW" && "Можно принять"}
                    {decision.result === "DEFER" && "Отложить"}
                    {decision.result === "FORBID" && "Отклонить"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {decision.reasonCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {decision.reasonCodes.map((code, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {code}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {selectedSlot && (
                  <div className="p-3 bg-accent/50 rounded-lg mb-4">
                    <p className="text-sm text-muted-foreground">Выбранный слот:</p>
                    <p className="font-medium">
                      {new Date(selectedSlot.start).toLocaleDateString("ru-RU", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Response Template */}
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Шаблон ответа</CardTitle>
                <CardDescription>Можете отредактировать перед отправкой</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            <Separator />

            <div className="flex gap-4">
              <Button variant="ghost" onClick={handleReset}>
                Отмена
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isProcessing}
                className="flex-1"
                variant={decision.result === "ALLOW" ? "default" : "secondary"}
              >
                {isProcessing ? "Сохраняю..." : decision.result === "ALLOW" ? "Подтвердить и создать обязательство" : "Готово"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
