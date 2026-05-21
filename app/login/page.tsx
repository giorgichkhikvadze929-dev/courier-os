import Link from 'next/link'
import { getT } from '@/lib/i18n-server'
import LoginForm from './LoginForm'
import LangPicker from '@/app/components/LangPicker'
import GoogleSignInButton from './GoogleSignInButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ awaiting?: string }>
}) {
  const { t: tr } = await getT()
  const sp = await searchParams

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 relative px-4">
      <div className="absolute top-4 right-4">
        <LangPicker />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{tr('appName')}</h1>
          <p className="text-sm text-gray-400 mt-1">{tr('brand_subtitle')}</p>
        </div>

        {sp.awaiting === '1' && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-amber-200">{tr('login_awaiting_title')}</p>
            <p className="text-xs text-amber-300/80 mt-1">{tr('login_awaiting_body')}</p>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-4">
          {/* Google OAuth */}
          <GoogleSignInButton label={tr('auth_continue_google')} />

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">{tr('auth_or')}</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Email / username + password */}
          <LoginForm
            s={{
              emailLabel:          tr('login_emailLabel'),
              passwordLabel:       tr('login_passwordLabel'),
              emailPlaceholder:    tr('login_emailPlaceholder'),
              passwordPlaceholder: tr('login_passwordPlaceholder'),
              signing:             tr('login_signing'),
              signin:              tr('btn_signin'),
              invalid:             tr('login_invalid'),
            }}
          />
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          {tr('login_no_account')}{' '}
          <Link href="/signup" className="text-blue-400 hover:text-blue-300 font-semibold">
            {tr('signup_btn_submit')}
          </Link>
        </p>
      </div>
    </main>
  )
}
