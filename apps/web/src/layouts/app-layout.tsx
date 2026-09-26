import { Avatar } from '@/components/catalyst/avatar'
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem, DropdownLabel, DropdownMenu } from '@/components/catalyst/dropdown'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from '@/components/catalyst/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '@/components/catalyst/sidebar'
import { SidebarLayout } from '@/components/catalyst/sidebar-layout'
import { ThemeSwitcher, ThemeToggleButton } from '@/components/app/theme-switcher'
import { AzzahAppIcon } from '@/components/brand/logo'
import { formResponses, reminders } from '@/data/mock'
import { useLang } from '@/i18n'
import {
  ArrowRightStartOnRectangleIcon,
  ChevronUpIcon,
  LanguageIcon,
} from '@heroicons/react/16/solid'
import {
  BellAlertIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HeartIcon,
  HomeIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'
import { Outlet, useLocation } from 'react-router'

function CountBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="ms-auto min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-xs/5 font-semibold text-white tabular-nums">
      {count}
    </span>
  )
}

export function AppLayout() {
  const { t, toggle } = useLang()
  const { pathname } = useLocation()
  const is = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path))

  const newResponses = formResponses.filter((r) => r.status === 'flagged' || r.status === 'new').length
  const failedReminders = reminders.filter((r) => r.status === 'failed').length

  const userMenu = (anchor: 'top start' | 'bottom end') => (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem onClick={toggle}>
        <LanguageIcon />
        <DropdownLabel>{t('app.switchLanguage')}</DropdownLabel>
      </DropdownItem>
      <DropdownItem href="/settings">
        <Cog6ToothIcon />
        <DropdownLabel>{t('nav.settings')}</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem href="#sign-out">
        <ArrowRightStartOnRectangleIcon className="rtl:-scale-x-100" />
        <DropdownLabel>{t('nav.signOut')}</DropdownLabel>
      </DropdownItem>
    </DropdownMenu>
  )

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <AzzahAppIcon className="size-8" />
          <NavbarSpacer />
          <NavbarSection>
            <ThemeToggleButton />
            <NavbarItem onClick={toggle} aria-label={t('app.switchLanguage')}>
              <LanguageIcon />
            </NavbarItem>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar initials="DR" square className="bg-brand-100 text-brand-700" />
              </DropdownButton>
              {userMenu('bottom end')}
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 px-2 py-2.5">
              <AzzahAppIcon className="size-10 shadow-sm" />
              <div className="min-w-0">
                <div className="truncate text-base/5 font-semibold text-zinc-950 dark:text-white">
                  {t('app.clinicName')}
                </div>
                <div className="truncate text-xs/5 text-zinc-500 dark:text-zinc-400">{t('app.clinicTagline')}</div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/" current={is('/')}>
                <HomeIcon />
                <SidebarLabel>{t('nav.overview')}</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/patients" current={is('/patients')}>
                <UsersIcon />
                <SidebarLabel>{t('nav.patients')}</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/pregnancy" current={is('/pregnancy')}>
                <HeartIcon />
                <SidebarLabel>{t('nav.pregnancy')}</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/appointments" current={is('/appointments')}>
                <CalendarDaysIcon />
                <SidebarLabel>{t('nav.appointments')}</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/forms" current={is('/forms')}>
                <ClipboardDocumentListIcon />
                <SidebarLabel>{t('nav.forms')}</SidebarLabel>
                <CountBadge count={newResponses} />
              </SidebarItem>
              <SidebarItem href="/reminders" current={is('/reminders')}>
                <BellAlertIcon />
                <SidebarLabel>{t('nav.reminders')}</SidebarLabel>
                <CountBadge count={failedReminders} />
              </SidebarItem>
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <SidebarItem onClick={toggle}>
                <LanguageIcon />
                <SidebarLabel>{t('app.switchLanguage')}</SidebarLabel>
              </SidebarItem>
              <ThemeSwitcher />
              <SidebarItem href="/settings" current={is('/settings')}>
                <Cog6ToothIcon />
                <SidebarLabel>{t('nav.settings')}</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>

          <SidebarFooter className="max-lg:hidden">
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar initials="DR" className="size-10 bg-brand-100 text-brand-700" square />
                  <span className="min-w-0">
                    <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                      {t('app.doctorName')}
                    </span>
                    <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                      {t('app.doctorRole')}
                    </span>
                  </span>
                </span>
                <ChevronUpIcon />
              </DropdownButton>
              {userMenu('top start')}
            </Dropdown>
          </SidebarFooter>
        </Sidebar>
      }
    >
      <Outlet />
    </SidebarLayout>
  )
}
