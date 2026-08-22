import { useState } from "react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const endpoint = isLogin ? "/api/login" : "/api/register";
    const body = isLogin 
      ? { username, password }
      : { username, password, displayName };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Ошибка авторизации");
        return;
      }

      // Сохраняем вошедшего пользователя в браузере
      localStorage.setItem("mesbook_user", JSON.stringify(data));
      window.location.href = "/";
    } catch (err) {
      setError("Ошибка соединения с сервером");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-black p-4 transition-colors duration-300">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-lg dark:shadow-none relative">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900 dark:text-white">
          {isLogin ? "Вход в Mesogram" : "Регистрация в Mesogram"}
        </h1>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-center text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Отображаемое имя</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
                placeholder="Ваше имя"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Никнейм (@username)</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
              placeholder="username"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
          >
            {isLogin ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isLogin ? "Ещё нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}
