import { useT } from '@bcbp-solutions-fzc-llc/frontend-sdk/react'
import { APP_ID } from '../../shared/constants/app'
import type { ThemeMode } from '../theme/themeMode'

export function BrandLogo({
  className = '',
  variant = 'mark',
  theme = 'light',
}: {
  className?: string
  variant?: 'mark' | 'main'
  theme?: ThemeMode
}) {
  const t = useT(APP_ID)
  if (variant === 'main') {
    const src = theme === 'dark' ? '/image/logo-main-white.png' : '/image/logo-main-black.png'
    return <img src={src} alt={t('brand.main')} className={`h-11 w-auto max-w-[12.5rem] object-contain ${className}`} />
  }
  return <img src="/image/logo.png" alt={t('brand.mark')} className={`h-9 w-9 object-contain ${className}`} />
}
