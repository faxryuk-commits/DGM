"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Role, LoadProfile, ActorType } from "@/lib/types";

// =============================================
// ONBOARDING STEPS (from spec):
// 1. Intro
// 2. Role diagnostic
// 3. Load profile
// 4. Money & support policy
// 5. Hard rules
// 6. Calendar connect
// 7. Confirm
// =============================================

const STEPS = [
  { id: "intro", title: "Добро пожаловать" },
  { id: "role", title: "Определение роли" },
  { id: "load", title: "Профиль нагрузки" },
  { id: "policies", title: "Политики" },
  { id: "rules", title: "Жёсткие правила" },
  { id: "calendar", title: "Календарь" },
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
  supportAllowedActors: ActorType[];
  hardRules: string[];
  calendarConnected: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [roleAnswers, setRoleAnswers] = useState<Role[]>([]);
  const [hardRuleInput, setHardRuleInput] = useState("");
  const [state, setState] = useState<OnboardingState>({
    moneyAllowedActors: ["family", "friend"],
    supportAllowedActors: ["family", "friend", "team"],
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
    if (step === 1 && roleAnswers.length === ROLE_QUESTIONS.length) {
      setState((s) => ({ ...s, primaryRole: calculateRole() }));
    }

    if (step === STEPS.length - 1) {
      // Submit profile
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          primaryRole: state.primaryRole,
          secondaryRole: state.secondaryRole,
          loadProfile: state.loadProfile,
          moneyPolicy: {
            requireReturnDate: true,
            allowedActors: state.moneyAllowedActors,
          },
          supportPolicy: {
            maxWeekly: 3,
            allowedActors: state.supportAllowedActors,
          },
          hardRules: state.hardRules,
          calendarConnected: state.calendarConnected,
        }),
      });
      router.push("/");
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
      case 1:
        return roleAnswers.length === ROLE_QUESTIONS.length;
      case 2:
        return !!state.loadProfile;
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
            {/* Step 0: Intro */}
            {step === 0 && (
              <div className="space-y-6">
                <CardDescription className="text-base leading-relaxed">
                  <strong>Decision OS</strong> — это система для принятия решений и управления обязательствами.
                </CardDescription>
                <div className="space-y-4 text-muted-foreground">
                  <p>Эта система:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Предотвращает импульсивное &quot;да&quot;</li>
                    <li>Защищает ваши границы</li>
                    <li>Устраняет размытые обещания</li>
                    <li>Создаёт обязательства только при соблюдении условий</li>
                  </ul>
                  <p className="pt-4 text-foreground font-medium">
                    Система НЕ даёт советов, НЕ мотивирует, НЕ принимает решения за вас.
                  </p>
                </div>
              </div>
            )}

            {/* Step 1: Role Diagnostic */}
            {step === 1 && (
              <div className="space-y-8">
                <CardDescription>
                  Ответьте на вопросы, чтобы определить вашу основную роль. Роль диагностируется, а не выбирается.
                </CardDescription>
                {ROLE_QUESTIONS.map((q, qIndex) => (
                  <div key={qIndex} className="space-y-4">
                    <p className="font-medium">{q.question}</p>
                    <RadioGroup
                      value={roleAnswers[qIndex]}
                      onValueChange={(v) => handleRoleAnswer(qIndex, v as Role)}
                    >
                      {q.options.map((opt) => (
                        <div key={opt.role} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                          <RadioGroupItem value={opt.role} id={`${qIndex}-${opt.role}`} />
                          <Label htmlFor={`${qIndex}-${opt.role}`} className="flex-1 cursor-pointer">
                            {opt.text}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
                {state.primaryRole && (
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Определённая роль:</p>
                    <p className="font-semibold text-lg">{ROLES.find((r) => r.id === state.primaryRole)?.name}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Load Profile */}
            {step === 2 && (
              <div className="space-y-6">
                <CardDescription>
                  Выберите профиль нагрузки, который соответствует вашей текущей ситуации.
                </CardDescription>
                <RadioGroup
                  value={state.loadProfile}
                  onValueChange={(v) => setState((s) => ({ ...s, loadProfile: v as LoadProfile }))}
                  className="space-y-4"
                >
                  {LOAD_PROFILES.map((profile) => (
                    <div
                      key={profile.id}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        state.loadProfile === profile.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={profile.id} id={profile.id} className="mt-1" />
                        <Label htmlFor={profile.id} className="flex-1 cursor-pointer">
                          <span className="font-semibold text-lg">{profile.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {profile.id}
                          </Badge>
                          <p className="text-muted-foreground mt-1">{profile.description}</p>
                        </Label>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Step 3: Money & Support Policies */}
            {step === 3 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="font-semibold">Политика денежных просьб</h3>
                  <CardDescription>Кому вы готовы давать деньги в долг?</CardDescription>
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

                <div className="space-y-4">
                  <h3 className="font-semibold">Политика поддержки</h3>
                  <CardDescription>Кому вы готовы оказывать эмоциональную поддержку?</CardDescription>
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
              </div>
            )}

            {/* Step 4: Hard Rules */}
            {step === 4 && (
              <div className="space-y-6">
                <CardDescription>
                  Укажите жёсткие правила — категории запросов, которые автоматически отклоняются.
                  Например: &quot;никаких созвонов до 10 утра&quot;, &quot;не даю денег коллегам&quot;.
                </CardDescription>
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
                        <span>{rule}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeHardRule(i)}>
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Calendar Connect */}
            {step === 5 && (
              <div className="space-y-6">
                <CardDescription>
                  Подключите Google Calendar для автоматической проверки доступности слотов.
                  Это необязательно — можно пропустить.
                </CardDescription>
                <div className="flex flex-col gap-4">
                  <Button
                    variant={state.calendarConnected ? "default" : "outline"}
                    className="w-full justify-center py-6"
                    onClick={() => setState((s) => ({ ...s, calendarConnected: true }))}
                  >
                    {state.calendarConnected ? "✓ Календарь подключён" : "Подключить Google Calendar"}
                  </Button>
                  {!state.calendarConnected && (
                    <p className="text-sm text-muted-foreground text-center">
                      Можно подключить позже в настройках
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 6: Confirm */}
            {step === 6 && (
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
            <Button variant="ghost" onClick={handleBack} disabled={step === 0}>
              Назад
            </Button>
            <Button onClick={handleNext} disabled={!canProceed()}>
              {step === STEPS.length - 1 ? "Завершить" : "Далее"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

