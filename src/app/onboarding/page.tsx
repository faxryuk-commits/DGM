"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getGoogleCalendarAuthUrl } from "@/lib/calendar-oauth";
import type { Role, LoadProfile, ActorType } from "@/lib/types";

// =============================================
// OPTIMIZED ONBOARDING - 4 STEPS:
// 1. Profile Setup (Intro + Role + Load Profile)
// 2. Policies (Money + Support)
// 3. Rules & Calendar (Hard Rules + Calendar)
// 4. Confirm
// =============================================

const STEPS = [
  { id: "profile", title: "Профиль" },
  { id: "policies", title: "Политики" },
  { id: "rules", title: "Правила и календарь" },
  { id: "confirm", title: "Подтверждение" },
] as const;

const ROLES: { id: Role; name: string; description: string }[] = [
  { id: "creator", name: "Создатель", description: "Глубокая работа, творчество, оригинальный контент" },
  { id: "manager", name: "Менеджер", description: "Координация, делегирование, работа с командой" },
  { id: "expert", name: "Эксперт", description: "Специализированные знания, консалтинг" },
  { id: "helper", name: "Помощник", description: "Поддержка других, сервис" },
  { id: "executor", name: "Исполнитель", description: "Выполнение задач, доставка результата" },
];

const ROLE_QUESTIONS = [
  {
    question: "Когда я работаю лучше всего, я...",
    options: [
      { role: "creator" as Role, text: "Погружаюсь в глубокую работу без отвлечений" },
      { role: "manager" as Role, text: "Координирую и направляю других" },
      { role: "expert" as Role, text: "Решаю сложные специализированные задачи" },
      { role: "helper" as Role, text: "Помогаю другим достичь их целей" },
      { role: "executor" as Role, text: "Чётко выполняю поставленные задачи" },
    ],
  },
  {
    question: "Когда приходит новый запрос, я обычно...",
    options: [
      { role: "creator" as Role, text: "Раздражаюсь из-за прерывания потока" },
      { role: "manager" as Role, text: "Думаю, кому это делегировать" },
      { role: "expert" as Role, text: "Оцениваю, требует ли это моей экспертизы" },
      { role: "helper" as Role, text: "Стараюсь помочь если возможно" },
      { role: "executor" as Role, text: "Добавляю в список задач" },
    ],
  },
  {
    question: "Мой идеальный рабочий день включает...",
    options: [
      { role: "creator" as Role, text: "Большие блоки непрерывного времени" },
      { role: "manager" as Role, text: "Встречи и синхронизации с командой" },
      { role: "expert" as Role, text: "Работу над сложными проблемами" },
      { role: "helper" as Role, text: "Помощь коллегам и клиентам" },
      { role: "executor" as Role, text: "Завершение конкретных задач" },
    ],
  },
];

const LOAD_PROFILES: { id: LoadProfile; name: string; description: string }[] = [
  { id: "A", name: "Высокая нагрузка", description: "Максимальная загрузка, минимум гибкости. 2 обязательства/день." },
  { id: "B", name: "Средняя нагрузка", description: "Сбалансированная загрузка. 4 обязательства/день." },
  { id: "C", name: "Низкая нагрузка", description: "Высокая доступность. 6 обязательств/день." },
];

interface OnboardingState {
  primaryRole?: Role;
  secondaryRole?: Role;
  loadProfile?: LoadProfile;
  moneyAllowedActors: ActorType[];
  moneyMaxAmount?: number;
  moneyRequireReturnDate: boolean;
  supportAllowedActors: ActorType[];
  supportMaxWeekly: number;
  hardRules: string[];
  calendarConnected: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [roleAnswers, setRoleAnswers] = useState<Role[]>([]);
  const [hardRuleInput, setHardRuleInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [state, setState] = useState<OnboardingState>({
    moneyAllowedActors: ["family", "friend"],
    moneyMaxAmount: undefined,
    moneyRequireReturnDate: true,
    supportAllowedActors: ["family", "friend", "team"],
    supportMaxWeekly: 3,
    hardRules: [],
    calendarConnected: false,
  });

  // Create user on mount
  useEffect(() => {
    const initUser = async () => {
      const stored = localStorage.getItem("userId");
      if (stored) {
        // Check if user has profile
        const res = await fetch(`/api/user?id=${stored}`);
        const data = await res.json();
        if (data.user?.profile) {
          router.push("/");
          return;
        }
        setUserId(stored);
      } else {
        const res = await fetch("/api/user");
        const data = await res.json();
        localStorage.setItem("userId", data.user.id);
        setUserId(data.user.id);
      }
    };
    initUser();
  }, [router]);

  const progress = ((step + 1) / STEPS.length) * 100;

  const calculateRole = (): Role => {
    const counts: Record<Role, number> = {
      creator: 0,
      manager: 0,
      expert: 0,
      helper: 0,
      executor: 0,
    };
    roleAnswers.forEach((r) => counts[r]++);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as Role;
  };

  const handleRoleAnswer = (questionIndex: number, role: Role) => {
    const newAnswers = [...roleAnswers];
    newAnswers[questionIndex] = role;
    setRoleAnswers(newAnswers);
  };

  const handleNext = async () => {
    // Calculate role when role questions are answered (step 0)
    if (step === 0 && roleAnswers.length === ROLE_QUESTIONS.length) {
      setState((s) => ({ ...s, primaryRole: calculateRole() }));
    }

    if (step === STEPS.length - 1) {
      // Submit profile
      try {
        setIsProcessing(true);
        const response = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            primaryRole: state.primaryRole,
            secondaryRole: state.secondaryRole,
            loadProfile: state.loadProfile,
            moneyPolicy: {
              requireReturnDate: state.moneyRequireReturnDate,
              allowedActors: state.moneyAllowedActors,
              maxAmount: state.moneyMaxAmount,
            },
            supportPolicy: {
              maxWeekly: state.supportMaxWeekly,
              allowedActors: state.supportAllowedActors,
            },
            hardRules: state.hardRules,
            calendarConnected: state.calendarConnected,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          alert(`Ошибка сохранения профиля: ${error.error || 'Неизвестная ошибка'}`);
          setIsProcessing(false);
          return;
        }

        // Profile saved successfully, wait a bit for DB to sync, then redirect
        await new Promise(resolve => setTimeout(resolve, 500));
        router.push("/");
      } catch (error) {
        console.error("Profile save error:", error);
        alert("Ошибка при сохранении профиля. Попробуйте ещё раз.");
        setIsProcessing(false);
      }
      return;
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const toggleActorType = (list: ActorType[], actor: ActorType, key: "moneyAllowedActors" | "supportAllowedActors") => {
    const newList = list.includes(actor) ? list.filter((a) => a !== actor) : [...list, actor];
    setState((s) => ({ ...s, [key]: newList }));
  };

  const addHardRule = () => {
    if (hardRuleInput.trim()) {
      setState((s) => ({ ...s, hardRules: [...s.hardRules, hardRuleInput.trim()] }));
      setHardRuleInput("");
    }
  };

  const removeHardRule = (index: number) => {
    setState((s) => ({ ...s, hardRules: s.hardRules.filter((_, i) => i !== index) }));
  };

  const canProceed = () => {
    switch (step) {
      case 0: // Profile step: need role answers AND load profile
        return roleAnswers.length === ROLE_QUESTIONS.length && !!state.loadProfile;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/20">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">
              Шаг {step + 1} из {STEPS.length}
            </span>
            <span className="text-sm font-medium">{STEPS[step].title}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">{STEPS[step].title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 0: Profile Setup (Intro + Role + Load Profile) */}
            {step === 0 && (
              <div className="space-y-8">
                {/* Intro */}
                <div className="space-y-4">
                  <CardDescription className="text-base leading-relaxed">
                    <strong>Decision OS</strong> — система для принятия решений и управления обязательствами.
                  </CardDescription>
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">Система предотвращает импульсивное &quot;да&quot;, защищает границы и создаёт обязательства только при соблюдении условий.</p>
                    <p className="text-xs italic">Система НЕ даёт советов, НЕ мотивирует, НЕ принимает решения за вас.</p>
                  </div>
                </div>

                <Separator />

                {/* Role Diagnostic */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">Определение роли</h3>
                    <CardDescription className="text-sm">
                      Ответьте на вопросы, чтобы определить вашу основную роль. Роль диагностируется, а не выбирается.
                    </CardDescription>
                  </div>
                  {ROLE_QUESTIONS.map((q, qIndex) => (
                    <div key={qIndex} className="space-y-3">
                      <p className="font-medium text-sm">{q.question}</p>
                      <RadioGroup
                        value={roleAnswers[qIndex]}
                        onValueChange={(v) => handleRoleAnswer(qIndex, v as Role)}
                      >
                        {q.options.map((opt) => (
                          <div key={opt.role} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value={opt.role} id={`${qIndex}-${opt.role}`} />
                            <Label htmlFor={`${qIndex}-${opt.role}`} className="flex-1 cursor-pointer text-sm">
                              {opt.text}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                  {state.primaryRole && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Определённая роль:</p>
                      <p className="font-semibold">{ROLES.find((r) => r.id === state.primaryRole)?.name}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Load Profile */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Профиль нагрузки</h3>
                    <CardDescription className="text-sm">
                      Выберите профиль, который соответствует вашей текущей ситуации.
                    </CardDescription>
                  </div>
                  <RadioGroup
                    value={state.loadProfile}
                    onValueChange={(v) => setState((s) => ({ ...s, loadProfile: v as LoadProfile }))}
                    className="space-y-3"
                  >
                    {LOAD_PROFILES.map((profile) => (
                      <div
                        key={profile.id}
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          state.loadProfile === profile.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem value={profile.id} id={profile.id} className="mt-1" />
                          <Label htmlFor={profile.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{profile.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {profile.id}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{profile.description}</p>
                          </Label>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* Step 1: Money & Support Policies */}
            {step === 1 && (
              <div className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">Политика денежных просьб</h3>
                    <CardDescription>Настройте правила для финансовых запросов</CardDescription>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Кому вы готовы давать деньги в долг?</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["family", "friend", "team", "client", "unknown"] as ActorType[]).map((actor) => (
                          <Button
                            key={actor}
                            variant={state.moneyAllowedActors.includes(actor) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleActorType(state.moneyAllowedActors, actor, "moneyAllowedActors")}
                          >
                            {actor === "family" && "Семья"}
                            {actor === "friend" && "Друзья"}
                            {actor === "team" && "Команда"}
                            {actor === "client" && "Клиенты"}
                            {actor === "unknown" && "Незнакомцы"}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="moneyMaxAmount" className="text-sm font-medium mb-2 block">
                          Максимальная сумма без обсуждения (₽)
                        </Label>
                        <Input
                          id="moneyMaxAmount"
                          type="number"
                          placeholder="Оставьте пустым, если нет лимита"
                          value={state.moneyMaxAmount || ""}
                          onChange={(e) => setState((s) => ({ 
                            ...s, 
                            moneyMaxAmount: e.target.value ? parseInt(e.target.value) : undefined 
                          }))}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Запросы выше этой суммы будут автоматически отложены
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="requireReturnDate"
                          checked={state.moneyRequireReturnDate}
                          onChange={(e) => setState((s) => ({ 
                            ...s, 
                            moneyRequireReturnDate: e.target.checked 
                          }))}
                          className="w-4 h-4 rounded border-border"
                        />
                        <Label htmlFor="requireReturnDate" className="text-sm cursor-pointer">
                          Требовать дату возврата
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">Политика поддержки</h3>
                    <CardDescription>Настройте правила для эмоциональной поддержки</CardDescription>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Кому вы готовы оказывать эмоциональную поддержку?</Label>
                      <div className="flex flex-wrap gap-2">
                        {(["family", "friend", "team", "client", "unknown"] as ActorType[]).map((actor) => (
                          <Button
                            key={actor}
                            variant={state.supportAllowedActors.includes(actor) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleActorType(state.supportAllowedActors, actor, "supportAllowedActors")}
                          >
                            {actor === "family" && "Семья"}
                            {actor === "friend" && "Друзья"}
                            {actor === "team" && "Команда"}
                            {actor === "client" && "Клиенты"}
                            {actor === "unknown" && "Незнакомцы"}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label htmlFor="supportMaxWeekly" className="text-sm font-medium mb-2 block">
                        Максимум запросов поддержки в неделю
                      </Label>
                      <Input
                        id="supportMaxWeekly"
                        type="number"
                        min="1"
                        max="20"
                        value={state.supportMaxWeekly}
                        onChange={(e) => setState((s) => ({ 
                          ...s, 
                          supportMaxWeekly: parseInt(e.target.value) || 1 
                        }))}
                        className="w-32"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        После достижения лимита новые запросы будут отклоняться
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Hard Rules & Calendar */}
            {step === 2 && (
              <div className="space-y-8">
                {/* Hard Rules */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Жёсткие правила</h3>
                    <CardDescription className="text-sm">
                      Укажите категории запросов, которые автоматически отклоняются.
                      Например: &quot;никаких созвонов до 10 утра&quot;, &quot;не даю денег коллегам&quot;.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Введите правило..."
                      value={hardRuleInput}
                      onChange={(e) => setHardRuleInput(e.target.value)}
                      className="flex-1"
                      rows={2}
                    />
                    <Button onClick={addHardRule} disabled={!hardRuleInput.trim()}>
                      Добавить
                    </Button>
                  </div>
                  {state.hardRules.length > 0 && (
                    <div className="space-y-2">
                      {state.hardRules.map((rule, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                          <span className="text-sm">{rule}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeHardRule(i)}>
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Calendar Connect */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Календарь</h3>
                    <CardDescription className="text-sm">
                      Подключите Google Calendar для автоматической проверки доступности слотов.
                      Это необязательно — можно пропустить.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-4">
                    {state.calendarConnected ? (
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="text-green-600 font-medium text-center">
                          ✓ Календарь подключён
                        </p>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-center py-6"
                          onClick={() => {
                            if (!userId) return;
                            
                            try {
                              const authUrl = getGoogleCalendarAuthUrl(userId);
                              window.location.href = authUrl;
                            } catch (error) {
                              console.error('OAuth init error:', error);
                              alert('Ошибка подключения календаря. Проверьте настройки NEXT_PUBLIC_GOOGLE_CLIENT_ID.');
                            }
                          }}
                        >
                          Подключить Google Calendar
                        </Button>
                        <p className="text-sm text-muted-foreground text-center">
                          Можно подключить позже в настройках
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <div className="space-y-6">
                <CardDescription>Проверьте ваши настройки перед завершением.</CardDescription>
                <div className="space-y-4">
                  <div className="p-4 bg-accent/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Роль</p>
                    <p className="font-semibold">{ROLES.find((r) => r.id === state.primaryRole)?.name || "Не определена"}</p>
                  </div>
                  <div className="p-4 bg-accent/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Профиль нагрузки</p>
                    <p className="font-semibold">{LOAD_PROFILES.find((p) => p.id === state.loadProfile)?.name || "Не выбран"}</p>
                  </div>
                  <div className="p-4 bg-accent/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Жёсткие правила</p>
                    <p className="font-semibold">{state.hardRules.length} правил(а)</p>
                  </div>
                  <div className="p-4 bg-accent/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Календарь</p>
                    <p className="font-semibold">{state.calendarConnected ? "Подключён" : "Не подключён"}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {/* Navigation */}
          <div className="p-6 pt-0 flex justify-between">
            <Button variant="ghost" onClick={handleBack} disabled={step === 0 || isProcessing}>
              Назад
            </Button>
            <Button onClick={handleNext} disabled={!canProceed() || isProcessing}>
              {isProcessing 
                ? "Сохранение..." 
                : step === STEPS.length - 1 
                ? "Завершить" 
                : "Далее"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

