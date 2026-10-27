import React, { useState, useRef } from 'react';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useModalA11y } from './useModalA11y';

interface AuthModalProps {
  isOpen: boolean;
  onLogin: (password: string) => Promise<boolean>;
  onClose?: () => void; // 提供时:ESC / 点遮罩可关闭,消除无出口的死循环(#28)
}

/**
 * 登录页：macOS 登录窗口的观感。
 *
 * 与普通弹窗的区别：
 * - 不是"白卡片浮在黑幕上"，而是壁纸上的一层玻璃面板
 * - 头像是 macOS 那种圆形用户头像位，密码框是系统样式的圆角输入
 * - 按钮是 macOS 的主按钮（系统蓝 + 微投影），不是粗大的整条色块
 */
const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onLogin, onClose }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  useModalA11y(isOpen, onClose, containerRef);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const success = await onLogin(password);
    if (!success) {
      setError('密码错误或无法连接服务器');
    }
    setIsLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'hsl(240 20% 8% / 0.42)', backdropFilter: 'blur(28px) saturate(150%)', WebkitBackdropFilter: 'blur(28px) saturate(150%)' }}
      onClick={onClose ? () => onClose() : undefined}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="身份验证"
        className="w-full max-w-[360px] overflow-hidden rounded-[14px] text-center"
        style={{
          background: 'hsl(0 0% 100% / 0.72)',
          boxShadow: 'inset 0 0 0 0.5px hsl(0 0% 100% / 0.75), 0 2px 8px hsl(240 30% 20% / 0.10), 0 18px 48px -12px hsl(240 30% 20% / 0.35)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pb-7 pt-8">
          {/* macOS 登录界面的圆形头像位 */}
          <div
            className="mx-auto mb-4 grid h-[68px] w-[68px] place-items-center rounded-full text-white"
            style={{
              background: 'linear-gradient(160deg, hsl(211 100% 62%), hsl(211 100% 44%))',
              boxShadow: 'inset 0 0 0 0.5px hsl(0 0% 100% / 0.5), 0 4px 14px -2px hsl(211 100% 45% / 0.45)',
            }}
          >
            <Lock size={30} strokeWidth={1.9} />
          </div>

          <h2 className="text-[15px] font-semibold tracking-tight text-ink">输入密码以解锁</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
            使用部署时设置的 PASSWORD 访问你的导航
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-2.5">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[8px] px-3 py-2 text-center text-[13px] tracking-[0.2em] text-ink outline-none transition-shadow placeholder:tracking-normal placeholder:text-ink-muted"
              style={{
                background: 'hsl(0 0% 100% / 0.85)',
                boxShadow: 'inset 0 0 0 0.5px hsl(240 10% 70% / 0.55), inset 0 1px 2px hsl(240 20% 30% / 0.06)',
              }}
              onFocus={e => { e.currentTarget.style.boxShadow = 'inset 0 0 0 2px hsl(var(--accent) / 0.65)'; }}
              onBlur={e => { e.currentTarget.style.boxShadow = 'inset 0 0 0 0.5px hsl(240 10% 70% / 0.55), inset 0 1px 2px hsl(240 20% 30% / 0.06)'; }}
              placeholder="密码"
              autoFocus
            />

            {error && (
              <p className="flex items-center justify-center gap-1 text-[11.5px] font-medium" style={{ color: 'hsl(var(--danger))' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="flex w-full items-center justify-center gap-1.5 rounded-[8px] py-2 text-[13px] font-medium text-ink-inverse transition-opacity disabled:opacity-40"
              style={{
                background: 'linear-gradient(180deg, hsl(211 100% 52%), hsl(211 100% 44%))',
                boxShadow: 'inset 0 0 0 0.5px hsl(211 100% 70% / 0.5), 0 1px 3px hsl(211 100% 35% / 0.35)',
              }}
            >
              {isLoading ? <Loader2 className="animate-spin" size={15} /> : <>解锁 <ArrowRight size={14} /></>}
            </button>
          </form>

          {onClose && (
            <p className="mt-4 text-[10.5px] leading-relaxed text-ink-muted">
              按 ESC 或点击空白处关闭；若始终失败，请确认已设置 PASSWORD 环境变量
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
