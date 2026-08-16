import { useState, useEffect } from 'react';
import { AppShell, PageIntro } from '@/components/mesbook-shell';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // При загрузке страницы достаем данные пользователя из памяти
  useEffect(() => {
    const stored = localStorage.getItem("mesbook_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      setDisplayName(parsed.displayName || '');
      setUsername(parsed.username || '');
      setAvatarUrl(parsed.avatarUrl || '');
    }
  }, []);

  // МАГИЯ: Конвертация картинки из галереи в текст (Base64)
  const handleImageUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string); // Сохраняем текстовый код картинки
      };
      reader.readAsDataURL(file); // Запускаем процесс чтения файла
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setMessage('Сохраняем...');
    setIsError(false);

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({ displayName, username, password, avatarUrl })
      });

      if (res.ok) {
        const updated = await res.json();
        // Обновляем память браузера новыми данными
        localStorage.setItem("mesbook_user", JSON.stringify(updated));
        setMessage('Профиль успешно обновлен! 🎉');
        setPassword(''); // Очищаем поле пароля ради безопасности
      } else {
        const err = await res.json();
        setMessage('Ошибка: ' + err.error);
        setIsError(true);
      }
    } catch(e) {
      setMessage('Ошибка соединения с сервером');
      setIsError(true);
    }
  };

  return (
    <AppShell>
      <PageIntro eyebrow="Settings" title="Профиль" subtitle="Настройте свой аккаунт" />
      
      <div className="px-5 pb-5 space-y-6">
        {/* Всплывающее сообщение об успехе или ошибке */}
        {message && (
          <div className={`p-4 font-bold rounded-2xl ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* Блок изменения фото */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
          <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Фото профиля</label>
          <div className="flex items-center gap-5">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-indigo-100 shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-300 text-2xl shrink-0">
                {displayName ? displayName.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <label className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold text-sm cursor-pointer hover:bg-indigo-700 transition active:scale-95 shadow-md">
              Выбрать из галереи
              {/* Скрытый инпут для вызова галереи телефона */}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
        </div>

        {/* Блок текстовых данных */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Имя</label>
            <input 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              className="w-full bg-gray-50 border-transparent rounded-2xl p-4 font-medium outline-none focus:border-indigo-500 focus:bg-white transition border-2" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Никнейм</label>
            <input 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full bg-gray-50 border-transparent rounded-2xl p-4 font-medium outline-none focus:border-indigo-500 focus:bg-white transition border-2" 
              placeholder="@nickname" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Новый пароль</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-gray-50 border-transparent rounded-2xl p-4 font-medium outline-none focus:border-indigo-500 focus:bg-white transition border-2" 
              placeholder="Оставь пустым, если не меняешь" 
            />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          className="w-full bg-black text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-gray-800 transition active:scale-95 text-lg"
        >
          Сохранить изменения
        </button>
      </div>
    </AppShell>
  );
}
