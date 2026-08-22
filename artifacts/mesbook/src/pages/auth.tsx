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
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black p-4 transition-colors duration-300">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-black p-8 border border-gray-200 dark:border-zinc-900 relative">
        <h1 className="mb-8 text-center text-3xl font-bold tracking-tight text-black dark:text-white uppercase">
          {isLogin ? "Вход" : "Регистрация"}
        </h1>

        {error && (
          <div className="mb-6 rounded-2xl bg-gray-100 dark:bg-zinc-900 p-4 text-center text-sm font-medium text-red-500 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                Имя в Mesogram
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-2xl border-none bg-gray-100 dark:bg-zinc-900 px-4 py-4 text-sm text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                placeholder="Как вас называть?"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
              Никнейм (@)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-2xl border-none bg-gray-100 dark:bg-zinc-900 px-4 py-4 text-sm text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="username"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
              Пароль
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-none bg-gray-100 dark:bg-zinc-900 px-4 py-4 text-sm text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-black dark:bg-white py-4 mt-2 text-sm font-bold text-white dark:text-black hover:opacity-80 active:scale-95 transition-all"
          >
            {isLogin ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
          >
            {isLogin ? "Ещё нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}
