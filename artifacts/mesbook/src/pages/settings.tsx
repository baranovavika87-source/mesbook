import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowLeft,
  User,
  Lock,
  Bell,
  Globe,
  ChevronRight,
  LogOut,
  Camera,
  Loader2,
  Check,
  Image as ImageIcon
} from 'lucide-react';

const translations = {
  ru: {
    settings: "Настройки",
    account: "Аккаунт",
    accountSub: "Номер, имя пользователя, «О себе»",
    chatSettings: "Настройки чатов",
    chatSettingsSub: "Обои, ночная тема, размер текста",
    privacy: "Конфиденциальность",
    privacySub: "Время захода, устройства, ключи доступа",
    notifications: "Уведомления",
    notificationsSub: "Звуки, звонки, счётчик сообщений",
    language: "Язык",
    languageSub: "Русский",
    logout: "Выйти из аккаунта",
    name: "Имя",
    username: "Никнейм (@username)",
    bio: "О себе",
    birthday: "Дата рождения",
    password: "Сменить пароль",
    cancel: "Отмена",
    save: "Сохранить",
    russian: "Русский",
    english: "English",
    theme: "Тема оформления",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    textSize: "Размер текста",
    chatBackground: "Цвет чата",
    previewText: "Привет, как твои дела?",
    previewTime: "12:34",
    messageRadius: "Скругление сообщений"
  },
  en: {
    settings: "Settings",
    account: "Account",
    accountSub: "Number, username, bio",
    chatSettings: "Chat Settings",
    chatSettingsSub: "Wallpaper, Night Mode, Text Size",
    privacy: "Privacy",
    privacySub: "Last seen, devices, passkeys",
    notifications: "Notifications",
    notificationsSub: "Sounds, calls, message counter",
    language: "Language",
    languageSub: "English",
    logout: "Log Out",
    name: "Name",
    username: "Username (@username)",
    bio: "Bio",
    birthday: "Birthday",
    password: "Change Password",
    cancel: "Cancel",
    save: "Save",
    russian: "Русский",
    english: "English",
    theme: "Appearance",
    themeLight: "Light",
    themeDark: "Dark",
    textSize: "Text Size",
    chatBackground: "Chat Color",
    previewText: "Hi, how are you?",
    previewTime: "12:34",
    messageRadius: "Message Corner Radius"
  }
};

type ViewState = 'main' | 'edit' | 'privacy' | 'language' | 'chat_settings';

export default function SettingsPage() {
  const [, setLocation] = useLocation();

  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('mesbook_user') || '{}');
    } catch (e) {
      return {};
    }
  });

  const [lang, setLang] = useState<'ru' | 'en'>(
    (localStorage.getItem('mesbook_lang') as 'ru' | 'en') || 'ru'
  );

  const t = translations[lang] || translations.ru;
  const [activeView, setActiveView] = useState<ViewState>('main');

  const [editName, setEditName] = useState(currentUser?.displayName || '');
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editBirthDate, setEditBirthDate] = useState(currentUser?.birthDate || '');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatar, setEditAvatar] = useState(currentUser?.avatarUrl || '');

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState(
    localStorage.getItem('mesbook_theme') || 'light'
  );

  const [textSize, setTextSize] = useState(
    Number(localStorage.getItem('mesbook_text_size')) || 16
  );

  const [wallpaper, setWallpaper] = useState(
    localStorage.getItem('mesbook_wallpaper') || ''
  );

  const [messageRadius, setMessageRadius] = useState(
    Number(localStorage.getItem('mesbook_message_radius')) || 18
  );

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleSaveChatSettings = () => {
    localStorage.setItem('mesbook_theme', theme);
    localStorage.setItem('mesbook_text_size', textSize.toString());
    localStorage.setItem('mesbook_wallpaper', wallpaper);
    localStorage.setItem('mesbook_message_radius', messageRadius.toString());
    setActiveView('main');
  };

  const cancelChatSettings = () => {
    const savedTheme = localStorage.getItem('mesbook_theme') || 'light';

    setTheme(savedTheme);
    setTextSize(Number(localStorage.getItem('mesbook_text_size')) || 16);
    setWallpaper(localStorage.getItem('mesbook_wallpaper') || '');
    setMessageRadius(
      Number(localStorage.getItem('mesbook_message_radius')) || 18
    );

    setActiveView('main');
  };

  const handleLogout = () => {
    localStorage.removeItem('mesbook_user');
    window.location.href = '/';
  };

  const selectLanguage = (newLang: 'ru' | 'en') => {
    localStorage.setItem('mesbook_lang', newLang);
    setLang(newLang);
    window.location.reload();
  };

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'mesogram-cloud');

    try {
      const res = await fetch(
        'https://api.cloudinary.com/v1_1/wrwmuyjl/auto/upload',
        {
          method: 'POST',
          body: formData
        }
      );

      const data = await res.json();

      if (data.secure_url) {
        setEditAvatar(data.secure_url);
      }
    } catch (err) {}

    setIsUploading(false);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);

    try {
      const bodyParams: any = {
        displayName: editName,
        username: editUsername,
        bio: editBio,
        birthDate: editBirthDate,
        avatarUrl: editAvatar
      };

      if (editPassword.trim() !== '') {
        bodyParams.password = editPassword.trim();
      }

      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + currentUser.id
        },
        body: JSON.stringify(bodyParams)
      });

      if (res.ok) {
        const updatedUser = await res.json();

        localStorage.setItem(
          'mesbook_user',
          JSON.stringify(updatedUser)
        );

        setCurrentUser(updatedUser);

        try {
          let accs = JSON.parse(
            localStorage.getItem('mesbook_accounts') || '[]'
          );

          accs = accs.map((a: any) =>
            String(a.id) === String(updatedUser.id)
              ? updatedUser
              : a
          );

          localStorage.setItem(
            'mesbook_accounts',
            JSON.stringify(accs)
          );
        } catch (e) {}

        setEditPassword('');
        setActiveView('main');
      }
    } catch (e) {}

    setIsSaving(false);
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onClick,
    hasBorder = true
  }: any) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3.5 active:bg-black/5 dark:active:bg-white/5 transition-colors w-full text-left ${
        hasBorder
          ? 'border-b border-black/5 dark:border-white/5'
          : ''
      }`}
    >
      <div className="w-[38px] h-[38px] flex-shrink-0 flex items-center justify-center rounded-[12px] bg-[#f5f5f7] dark:bg-[#161618] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/5 dark:border-white/5">
        {icon}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden pr-2">
        <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
          {title}
        </span>

        <span className="text-[13px] text-[#86868b] dark:text-[#98989d] truncate mt-[1px]">
          {subtitle}
        </span>
      </div>

      <ChevronRight
        size={18}
        className="text-[#86868b] dark:text-[#98989d] flex-shrink-0"
      />
    </button>
  );

  if (activeView === 'edit') {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] font-sans overflow-y-auto">
        <header className="flex items-center justify-between px-5 pt-12 pb-5 sticky top-0 z-20 bg-[#f5f5f7]/85 dark:bg-[#161618]/85 backdrop-blur-2xl">
          <button
            onClick={() => setActiveView('main')}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#222224] flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] shadow-sm active:scale-95 transition-transform"
          >
            <ArrowLeft size={22} />
          </button>

          <h1 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {t.account}
          </h1>

          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="h-10 px-4 rounded-full bg-[#1d1d1f] dark:bg-[#f5f5f7] text-white dark:text-[#1d1d1f] font-medium text-[14px] active:scale-95 transition-transform"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              t.save
            )}
          </button>
        </header>

        <main className="w-full max-w-xl mx-auto px-5 pb-12">
          <section className="relative overflow-hidden rounded-[30px] bg-[#1d1d1f] dark:bg-[#222224] p-6 mb-6 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
            <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -left-10 -bottom-20 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

            <div className="relative flex items-center gap-5">
              <div
                className="relative w-[92px] h-[92px] rounded-full overflow-hidden bg-[#3b3b40] flex items-center justify-center border-2 border-white/20 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {editAvatar && editAvatar.length > 5 ? (
                  <img
                    src={editAvatar}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[34px] font-semibold text-white">
                    {editName.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}

                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2
                      size={24}
                      className="text-white animate-spin"
                    />
                  </div>
                )}

                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-md">
                  <Camera size={14} className="text-[#1d1d1f]" />
                </div>
              </div>

              <div className="relative min-w-0">
                <h2 className="text-[21px] font-semibold text-white truncate">
                  {editName || 'Пользователь'}
                </h2>

                <p className="text-[14px] text-white/60 truncate mt-1">
                  {editUsername || '@username'}
                </p>

                <p className="text-[12px] text-white/40 mt-3">
                  Нажмите на фото, чтобы изменить
                </p>
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
            />
          </section>

          <section className="mb-5">
            <h3 className="px-1 mb-2 text-[12px] font-bold uppercase tracking-wider text-[#86868b] dark:text-[#98989d]">
              Личная информация
            </h3>

            <div className="rounded-[24px] overflow-hidden bg-white dark:bg-[#222224] border border-black/5 dark:border-white/5 shadow-[0_3px_18px_rgba(0,0,0,0.04)]">
              <div className="px-5 py-4 border-b border-black/5 dark:border-white/5">
                <label className="block text-[12px] text-[#86868b] dark:text-[#98989d] mb-1">
                  {t.name}
                </label>

                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-transparent text-[17px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
              </div>

              <div className="px-5 py-4 border-b border-black/5 dark:border-white/5">
                <label className="block text-[12px] text-[#86868b] dark:text-[#98989d] mb-1">
                  {t.username}
                </label>

                <input
                  type="text"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="w-full bg-transparent text-[17px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
              </div>

              <div className="px-5 py-4 border-b border-black/5 dark:border-white/5">
                <label className="block text-[12px] text-[#86868b] dark:text-[#98989d] mb-1">
                  {t.birthday}
                </label>

                <input
                  type="date"
                  value={editBirthDate}
                  onChange={e => setEditBirthDate(e.target.value)}
                  className="w-full bg-transparent text-[17px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              <div className="px-5 py-4">
                <label className="block text-[12px] text-[#86868b] dark:text-[#98989d] mb-2">
                  {t.bio}
                </label>

                <textarea
                  rows={4}
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  placeholder="Расскажите немного о себе..."
                  className="w-full bg-transparent text-[16px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] outline-none resize-none placeholder:text-[#b0b0b5] dark:placeholder:text-[#66666b]"
                />
              </div>
            </div>
          </section>

          <div className="rounded-[20px] bg-[#e9e9ee] dark:bg-[#222224] px-4 py-3 text-[13px] leading-relaxed text-[#86868b] dark:text-[#98989d]">
            Изменения профиля будут применены после нажатия кнопки «{t.save}».
          </div>
        </main>
      </div>
    );
  }

  if (activeView === 'chat_settings') {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans animate-in slide-in-from-right-8 duration-300 ease-out overflow-y-auto">
        <header className="flex items-center justify-between px-4 pt-12 pb-4 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 border-b border-black/5 dark:border-white/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button
              onClick={cancelChatSettings}
              className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"
            >
              <ArrowLeft size={26} strokeWidth={2} />
            </button>

            <h1 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
              {t.chatSettings}
            </h1>
          </div>

          <button
            onClick={handleSaveChatSettings}
            className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[16px] px-2 py-1 active:scale-95 transition-transform"
          >
            {t.save}
          </button>
        </header>

        <div className="flex flex-col max-w-2xl mx-auto w-full pb-10">
          <div
            className="mx-4 mt-6 h-[220px] rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-black/5 dark:border-white/5 relative bg-cover bg-center transition-all duration-300"
            style={{
              background: wallpaper ? wallpaper : undefined,
              backgroundColor: !wallpaper
                ? theme === 'dark'
                  ? '#161618'
                  : '#e5e5ea'
                : undefined
            }}
          >
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              <div
                className="bg-white dark:bg-[#222224] p-3 max-w-[85%] self-start shadow-sm border border-black/5 dark:border-white/5 transition-all"
                style={{
                  borderRadius: `${messageRadius}px`,
                  borderTopLeftRadius: '4px'
                }}
              >
                <div
                  style={{ fontSize: `${textSize}px` }}
                  className="text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug"
                >
                  {t.previewText}
                </div>

                <div className="flex justify-end mt-1">
                  <span className="text-[11px] text-[#86868b] dark:text-[#98989d]">
                    {t.previewTime}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 mt-6">
            <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 p-5 flex flex-col gap-4">
              <span className="text-[12px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider">
                {t.textSize}:{' '}
                <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {textSize}
                </span>
              </span>

              <div className="flex items-center gap-4">
                <span className="text-[14px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  A
                </span>

                <input
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  value={textSize}
                  onChange={e => setTextSize(Number(e.target.value))}
                  className="w-full h-1 bg-[#e5e5ea] dark:bg-[#333336] rounded-lg appearance-none cursor-pointer accent-[#1d1d1f] dark:accent-[#f5f5f7]"
                />

                <span className="text-[22px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  A
                </span>
              </div>
            </div>
          </div>

          <div className="px-4 mt-4">
            <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 p-5 flex flex-col gap-4">
              <span className="text-[12px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider">
                {t.messageRadius}:{' '}
                <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {messageRadius}px
                </span>
              </span>

              <div className="flex items-center gap-4">
                <div
                  className="w-6 h-6 bg-[#1d1d1f] dark:bg-[#f5f5f7]"
                  style={{ borderRadius: '2px' }}
                />

                <input
                  type="range"
                  min="0"
                  max="22"
                  step="2"
                  value={messageRadius}
                  onChange={e =>
                    setMessageRadius(Number(e.target.value))
                  }
                  className="w-full h-1 bg-[#e5e5ea] dark:bg-[#333336] rounded-lg appearance-none cursor-pointer accent-[#1d1d1f] dark:accent-[#f5f5f7]"
                />

                <div className="w-6 h-6 bg-[#1d1d1f] dark:bg-[#f5f5f7] rounded-full" />
              </div>
            </div>
          </div>

          <div className="px-4 mt-4">
            <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 flex overflow-hidden p-1">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 py-2.5 rounded-[20px] text-[15px] font-medium transition-all ${
                  theme === 'light'
                    ? 'bg-[#1d1d1f] text-white dark:bg-[#f5f5f7] dark:text-[#1d1d1f] shadow-sm'
                    : 'text-[#86868b] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {t.themeLight}
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 py-2.5 rounded-[20px] text-[15px] font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-[#1d1d1f] text-white dark:bg-[#f5f5f7] dark:text-[#1d1d1f] shadow-sm'
                    : 'text-[#86868b] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {t.themeDark}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeView === 'privacy') {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans animate-in slide-in-from-right-8 duration-300 ease-out overflow-y-auto">
        <header className="flex items-center justify-between px-4 pt-12 pb-4 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 border-b border-black/5 dark:border-white/5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveView('main')}
              className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"
            >
              <ArrowLeft size={26} strokeWidth={2} />
            </button>

            <h1 className="text-[20px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
              {t.privacy}
            </h1>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[16px] px-2 py-1 active:scale-95 transition-transform"
          >
            {isSaving ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              t.save
            )}
          </button>
        </header>

        <div className="px-4 flex flex-col gap-4 max-w-2xl mx-auto w-full pt-6">
          <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none overflow-hidden border border-black/5 dark:border-white/5 flex flex-col">
            <div className="px-5 py-3 border-b border-black/5 dark:border-white/5">
              <label className="block text-[11px] font-bold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider mt-1">
                {t.password}
              </label>

              <input
                type="password"
                value={editPassword}
                onChange={e => setEditPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent py-1.5 text-[17px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="bg-white dark:bg-[#222224] rounded-[18px] py-3.5 px-4 flex items-center justify-center gap-2 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[15px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-black/5 dark:border-white/5 active:scale-[0.98] transition-all"
          >
            <LogOut
              size={18}
              strokeWidth={2}
              className="text-[#1d1d1f] dark:text-[#f5f5f7]"
            />

            {t.logout}
          </button>
        </div>
      </div>
    );
  }

  if (activeView === 'language') {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans animate-in slide-in-from-right-8 duration-300 ease-out overflow-y-auto">
        <header className="flex items-center gap-6 px-4 pt-12 pb-4 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10 border-b border-black/5 dark:border-white/5">
          <button
            onClick={() => setActiveView('main')}
            className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95"
          >
            <ArrowLeft size={26} strokeWidth={2} />
          </button>

          <h1 className="text-[22px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            {t.language}
          </h1>
        </header>

        <div className="px-4 flex flex-col gap-4 max-w-2xl mx-auto w-full pt-6">
          <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 overflow-hidden flex flex-col">
            <button
              onClick={() => selectLanguage('ru')}
              className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5 active:bg-black/5 dark:active:bg-white/5 transition-colors"
            >
              <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                Русский
              </span>

              {lang === 'ru' && (
                <Check
                  size={20}
                  strokeWidth={2.5}
                  className="text-[#1d1d1f] dark:text-[#f5f5f7]"
                />
              )}
            </button>

            <button
              onClick={() => selectLanguage('en')}
              className="flex items-center justify-between p-4 active:bg-black/5 dark:active:bg-white/5 transition-colors"
            >
              <span className="text-[16px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                English
              </span>

              {lang === 'en' && (
                <Check
                  size={20}
                  strokeWidth={2.5}
                  className="text-[#1d1d1f] dark:text-[#f5f5f7]"
                />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f5f5f7] dark:bg-[#161618] transition-colors duration-300 font-sans selection:bg-[#1d1d1f]/20 dark:selection:bg-[#f5f5f7]/20 animate-in slide-in-from-right-8 fade-in duration-300 ease-out">
      <header className="flex items-center gap-6 px-4 pt-12 pb-4 sticky top-0 bg-[#f5f5f7]/80 dark:bg-[#161618]/80 backdrop-blur-xl z-10">
        <Link href="/">
          <a className="text-[#1d1d1f] dark:text-[#f5f5f7] transition-transform active:scale-95">
            <ArrowLeft size={26} strokeWidth={2} />
          </a>
        </Link>

        <h1 className="text-[22px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
          {t.settings}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-10">
        <div className="flex flex-col items-center pt-2 pb-6">
          <div className="w-[100px] h-[100px] rounded-full overflow-hidden bg-[#e5e5ea] dark:bg-[#333336] border border-black/5 dark:border-white/5 mb-3 shadow-sm flex items-center justify-center">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[32px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                {currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>

          <h2 className="text-[20px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            {currentUser?.displayName || 'Пользователь'}
          </h2>

          <p className="text-[15px] text-[#86868b] dark:text-[#98989d] mt-0.5">
            {currentUser?.username || '@username'}
          </p>
        </div>

        <div className="px-4 flex flex-col gap-4 max-w-2xl mx-auto w-full">
          <div className="bg-white dark:bg-[#222224] rounded-[24px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] dark:shadow-none border border-black/5 dark:border-white/5 overflow-hidden flex flex-col">
            <SettingItem
              icon={<User size={20} strokeWidth={2.5} />}
              title={t.account}
              subtitle={t.accountSub}
              onClick={() => setActiveView('edit')}
              hasBorder={true}
            />

            <SettingItem
              icon={<ImageIcon size={20} strokeWidth={2.5} />}
              title={t.chatSettings}
              subtitle={t.chatSettingsSub}
              onClick={() => setActiveView('chat_settings')}
              hasBorder={true}
            />

            <SettingItem
              icon={<Lock size={20} strokeWidth={2.5} />}
              title={t.privacy}
              subtitle={t.privacySub}
              onClick={() => setActiveView('privacy')}
              hasBorder={true}
            />

            <SettingItem
              icon={<Bell size={20} strokeWidth={2.5} />}
              title={t.notifications}
              subtitle={t.notificationsSub}
              hasBorder={true}
            />

            <SettingItem
              icon={<Globe size={20} strokeWidth={2.5} />}
              title={t.language}
              subtitle={lang === 'ru' ? t.russian : t.english}
              onClick={() => setActiveView('language')}
              hasBorder={false}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
